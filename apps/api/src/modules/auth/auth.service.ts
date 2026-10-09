import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Env } from '@dispatch/config';
import { Role, RoleSchema, TokenPair } from '@dispatch/contracts';
import { AppException } from '../../common/app-exception';
import { AuthUser } from '../../common/decorators';
import { APP_CONFIG } from '../../config/config.module';
import { sha256Hex } from '../../domain/hash';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../infra/prisma.service';
import { dummyHash, verifyPassword } from './password';

interface RefreshRow {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
}

type RefreshOutcome = { kind: 'ok'; pair: TokenPair } | { kind: 'reuse' } | { kind: 'invalid' };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly cfg: Env,
  ) {}

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    const ok = await verifyPassword(user?.passwordHash ?? (await dummyHash()), password);
    if (!user || !ok || user.status !== 'ACTIVE') {
      await this.audit.record(this.prisma, {
        actorId: null,
        actorRole: 'ANONYMOUS',
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: user?.id ?? 'unknown',
        metadata: { emailHash: sha256Hex(email.toLowerCase()).slice(0, 16) },
      });
      throw new AppException('UNAUTHENTICATED', 'Invalid credentials');
    }
    const role = RoleSchema.parse(user.role);
    await this.audit.record(this.prisma, {
      actorId: user.id,
      actorRole: role,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
    });
    return this.issue({ id: user.id, name: user.name, role }, randomUUID());
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const hash = sha256Hex(refreshToken);
    const outcome = await this.prisma.tx<RefreshOutcome>(async (tx) => {
      const rows = await tx.$queryRaw<RefreshRow[]>`
        SELECT id::text, user_id::text, family_id::text, expires_at, revoked_at
        FROM refresh_tokens WHERE token_hash = ${hash} FOR UPDATE`;
      const rt = rows[0];
      if (!rt) return { kind: 'invalid' };
      if (rt.revoked_at) {
        // A rotated token was presented again: assume theft and revoke the whole family.
        await tx.$executeRaw`UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = ${rt.family_id}::uuid AND revoked_at IS NULL`;
        await this.audit.record(tx, {
          actorId: rt.user_id,
          actorRole: 'ANONYMOUS',
          action: 'auth.refresh_reuse_detected',
          entityType: 'user',
          entityId: rt.user_id,
        });
        return { kind: 'reuse' };
      }
      if (rt.expires_at.getTime() <= Date.now()) return { kind: 'invalid' };
      const user = await tx.user.findUnique({ where: { id: rt.user_id } });
      if (!user || user.status !== 'ACTIVE') return { kind: 'invalid' };

      const next = this.newRefreshToken();
      const created = await tx.refreshToken.create({
        data: {
          userId: user.id,
          familyId: rt.family_id,
          tokenHash: sha256Hex(next),
          expiresAt: new Date(Date.now() + this.cfg.REFRESH_TOKEN_TTL_SECONDS * 1000),
        },
      });
      await tx.$executeRaw`UPDATE refresh_tokens SET revoked_at = now(), replaced_by = ${created.id}::uuid WHERE id = ${rt.id}::uuid`;
      const role = RoleSchema.parse(user.role);
      return { kind: 'ok', pair: await this.sign({ id: user.id, name: user.name, role }, next) };
    });
    if (outcome.kind !== 'ok') throw new AppException('UNAUTHENTICATED', 'Invalid refresh token');
    return outcome.pair;
  }

  async logout(userId: string): Promise<void> {
    await this.prisma
      .$executeRaw`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ${userId}::uuid AND revoked_at IS NULL`;
  }

  /** Verifies an access token and loads the CURRENT role/status from the database (never from the token). */
  async authenticate(token: string): Promise<AuthUser> {
    return (await this.verifyToken(token)).user;
  }

  /** Same as authenticate, plus the token expiry (epoch seconds) so long-lived sockets can be cut off. */
  async verifyToken(token: string): Promise<{ user: AuthUser; exp: number }> {
    let sub: string;
    let exp: number;
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: string; exp?: number }>(token, {
        secret: this.cfg.JWT_ACCESS_SECRET,
        algorithms: ['HS256'],
      });
      if (!payload.sub || !payload.exp) throw new Error('missing claims');
      sub = payload.sub;
      exp = payload.exp;
    } catch {
      throw new AppException('UNAUTHENTICATED');
    }
    const user = await this.prisma.user.findUnique({ where: { id: sub } });
    if (!user || user.status !== 'ACTIVE') throw new AppException('UNAUTHENTICATED');
    return { user: { id: user.id, name: user.name, role: user.role as Role }, exp };
  }

  private newRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private async issue(user: AuthUser, familyId: string): Promise<TokenPair> {
    const refresh = this.newRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: sha256Hex(refresh),
        expiresAt: new Date(Date.now() + this.cfg.REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    });
    return this.sign(user, refresh);
  }

  private async sign(user: AuthUser, refreshToken: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id },
      {
        secret: this.cfg.JWT_ACCESS_SECRET,
        algorithm: 'HS256',
        expiresIn: this.cfg.ACCESS_TOKEN_TTL_SECONDS,
      },
    );
    return {
      accessToken,
      refreshToken,
      expiresIn: this.cfg.ACCESS_TOKEN_TTL_SECONDS,
      user: { id: user.id, name: user.name, role: user.role },
    };
  }
}
