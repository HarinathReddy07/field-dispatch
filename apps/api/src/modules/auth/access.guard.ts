import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Env } from '@dispatch/config';
import type { Role } from '@dispatch/contracts';
import { AppException } from '../../common/app-exception';
import { ctxStore } from '../../common/context';
import { AuthUser, IS_PUBLIC, ROLES_KEY, THROTTLE_KEY, ThrottleBucket } from '../../common/decorators';
import { APP_CONFIG } from '../../config/config.module';
import { sha256Hex } from '../../domain/hash';
import { RedisService } from '../../infra/redis.service';
import { AuthService } from './auth.service';

/**
 * One global guard so the order is deterministic: authenticate -> authorize (role) -> throttle.
 * Default-deny: a non-public handler without @Roles is rejected, so a forgotten decorator can't expose a route.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly cfg: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets) ?? false;
    const bucket = this.reflector.getAllAndOverride<ThrottleBucket>(THROTTLE_KEY, targets) ?? 'default';
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();

    if (!isPublic) {
      const header = req.headers.authorization;
      const match = typeof header === 'string' ? /^Bearer\s+(\S+)$/i.exec(header) : null;
      if (!match) throw new AppException('UNAUTHENTICATED');
      req.user = await this.auth.authenticate(match[1]!);
      const store = ctxStore.getStore();
      if (store) {
        store.userId = req.user.id;
        store.role = req.user.role;
      }
      const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);
      if (!roles || !roles.includes(req.user.role)) throw new AppException('FORBIDDEN');
    }

    await this.throttle(req, bucket);
    return true;
  }

  private async throttle(req: Request & { user?: AuthUser }, bucket: ThrottleBucket): Promise<void> {
    const ip = req.ip ?? 'unknown';
    const limit =
      bucket === 'login'
        ? this.cfg.THROTTLE_LOGIN_PER_MIN
        : bucket === 'arrive'
          ? this.cfg.THROTTLE_ARRIVE_PER_MIN
          : this.cfg.THROTTLE_DEFAULT_PER_MIN;
    const subjects = [`ip:${ip}`];
    if (req.user) subjects.push(`u:${req.user.id}`);
    if (bucket === 'login') {
      const email = (req.body as { email?: unknown } | undefined)?.email;
      if (typeof email === 'string') subjects.push(`e:${sha256Hex(email.toLowerCase()).slice(0, 24)}`);
    }
    try {
      for (const s of subjects) {
        const count = await this.redis.hit(`thr:${bucket}:${s}`, 60);
        if (count > limit) throw new AppException('RATE_LIMITED');
      }
    } catch (e) {
      if (e instanceof AppException) throw e;
      // Redis unavailable: fail open for generic traffic; OTP attempts are still bounded in the database.
    }
  }
}
