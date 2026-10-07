import { Inject, Injectable } from '@nestjs/common';
import type { Env } from '@dispatch/config';
import { OtpResponse, RequestView } from '@dispatch/contracts';
import { AppException } from '../../common/app-exception';
import { AuthUser } from '../../common/decorators';
import { APP_CONFIG } from '../../config/config.module';
import { evaluateOtpAttempt, generateOtp, hmacOtp, verifyOtp } from '../../domain/otp';
import { AuditService } from '../../infra/audit.service';
import { IdempotencyService } from '../../infra/idempotency.service';
import { PrismaService, Tx } from '../../infra/prisma.service';
import { lockRequest } from '../../infra/request-sql';
import { TransitionService } from '../../infra/transition.service';
import { RequestsRepository } from '../requests/requests.repository';
import { AssignmentsService } from './assignments.service';

interface ChallengeRow {
  id: string;
  otp_hmac: string;
  attempts: number;
  locked_until: Date | null;
  consumed_at: Date | null;
  expired: boolean;
  db_now: Date;
}

/** Outcomes are returned (not thrown) so failed-attempt counters commit; the caller throws after commit. */
type ArriveOutcome = { kind: 'ok'; view: RequestView } | { kind: 'invalid' } | { kind: 'locked' };

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: AssignmentsService,
    private readonly transitions: TransitionService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
    private readonly repo: RequestsRepository,
    @Inject(APP_CONFIG) private readonly cfg: Env,
  ) {}

  /** Requester displays a fresh arrival code. Only the HMAC is stored; the plain code is returned once. */
  async issue(user: AuthUser, requestId: string): Promise<OtpResponse> {
    return this.prisma.tx(async (tx) => {
      const req = await lockRequest(tx, requestId);
      if (!req || req.requester_id !== user.id) throw new AppException('NOT_FOUND');
      if (req.state !== 'CONFIRMED')
        throw new AppException('STATE_CONFLICT', 'An arrival code can only be issued for an assigned job');
      const active = await this.assignments.activeTechnician(tx, requestId);
      if (!active) throw new AppException('STATE_CONFLICT');

      await tx.$executeRaw`
        UPDATE otp_challenges SET superseded_at = now()
        WHERE request_id = ${requestId}::uuid AND consumed_at IS NULL AND superseded_at IS NULL`;
      const otp = generateOtp();
      const rows = await tx.$queryRaw<{ id: string; expires_at: Date }[]>`
        INSERT INTO otp_challenges (request_id, assignment_id, otp_hmac, expires_at)
        VALUES (${requestId}::uuid, ${active.assignmentId}::uuid, ${hmacOtp(this.cfg.OTP_HMAC_SECRET, requestId, otp)},
                now() + make_interval(secs => ${this.cfg.OTP_TTL_SECONDS}::float8))
        RETURNING id::text AS id, expires_at`;
      await this.audit.record(tx, {
        actorId: user.id,
        actorRole: 'REQUESTER',
        action: 'otp.issue',
        entityType: 'otp_challenge',
        entityId: rows[0]!.id,
        requestId,
        metadata: { ttlSeconds: this.cfg.OTP_TTL_SECONDS }, // never the code itself
      });
      return { otp, expiresAt: rows[0]!.expires_at.toISOString() };
    });
  }

  /** Technician submits the code. One-shot, attempt-limited, uniform failure text. */
  async arrive(user: AuthUser, requestId: string, otp: string, key: string): Promise<RequestView> {
    const outcome = await this.prisma.tx((tx) =>
      this.idempotency.run<ArriveOutcome>(
        tx,
        {
          userId: user.id,
          method: 'POST',
          route: '/requests/:id/arrive',
          resourceId: requestId,
          key,
          // Keyed HMAC, never the raw/plain-hashed code, so the idempotency table can't be used to brute force OTPs.
          body: { otp: hmacOtp(this.cfg.OTP_HMAC_SECRET, requestId, otp) },
        },
        () => this.arriveIn(tx, user, requestId, otp),
      ),
    );
    if (outcome.kind === 'locked') throw new AppException('OTP_LOCKED');
    if (outcome.kind === 'invalid') throw new AppException('OTP_INVALID');
    return outcome.view;
  }

  private async arriveIn(tx: Tx, user: AuthUser, requestId: string, otp: string): Promise<ArriveOutcome> {
    const req = await lockRequest(tx, requestId);
    if (!req || !(await this.assignments.isActiveAssignee(tx, requestId, user.id)))
      throw new AppException('NOT_FOUND');
    if (req.state !== 'CONFIRMED') {
      // Also covers replay of an already-consumed code once the job has moved on.
      throw new AppException(
        'ILLEGAL_TRANSITION',
        `Action ARRIVE is not allowed while the request is ${req.state}`,
      );
    }

    const rows = await tx.$queryRaw<ChallengeRow[]>`
      SELECT id::text AS id, otp_hmac, attempts, locked_until, consumed_at,
             (expires_at <= now()) AS expired, now() AS db_now
      FROM otp_challenges
      WHERE request_id = ${requestId}::uuid AND superseded_at IS NULL
      ORDER BY created_at DESC LIMIT 1 FOR UPDATE`;
    const ch = rows[0];
    if (!ch) return { kind: 'invalid' };

    const decision = evaluateOtpAttempt({
      attempts: ch.attempts,
      maxAttempts: this.cfg.OTP_MAX_ATTEMPTS,
      lockedUntil: ch.locked_until,
      now: ch.db_now,
      lockSeconds: this.cfg.OTP_LOCK_SECONDS,
      correct: verifyOtp(this.cfg.OTP_HMAC_SECRET, requestId, otp, ch.otp_hmac),
      expired: ch.expired,
      consumed: ch.consumed_at !== null,
    });

    if (decision.outcome === 'LOCKED') return { kind: 'locked' };
    if (decision.outcome === 'INVALID') {
      await tx.$executeRaw`
        UPDATE otp_challenges SET attempts = ${decision.attempts}::int, locked_until = ${decision.lockedUntil}::timestamptz
        WHERE id = ${ch.id}::uuid`;
      await this.audit.record(tx, {
        actorId: user.id,
        actorRole: 'TECHNICIAN',
        action: decision.lockedUntil ? 'otp.locked' : 'otp.failed',
        entityType: 'otp_challenge',
        entityId: ch.id,
        requestId,
        metadata: { attempts: decision.attempts },
      });
      return { kind: 'invalid' };
    }

    // Atomic one-shot consume: the conditional UPDATE is the backstop to the row lock above.
    const consumed = await tx.$queryRaw<{ id: string }[]>`
      UPDATE otp_challenges SET consumed_at = now(), attempts = 0, locked_until = NULL
      WHERE id = ${ch.id}::uuid AND consumed_at IS NULL AND superseded_at IS NULL AND expires_at > now()
      RETURNING id::text AS id`;
    if (consumed.length === 0) return { kind: 'invalid' };

    await this.transitions.apply(tx, {
      requestId,
      action: 'ARRIVE',
      actor: { id: user.id, role: 'TECHNICIAN' },
      metadata: { challengeId: ch.id },
    });
    await this.audit.record(tx, {
      actorId: user.id,
      actorRole: 'TECHNICIAN',
      action: 'otp.consumed',
      entityType: 'otp_challenge',
      entityId: ch.id,
      requestId,
    });
    return { kind: 'ok', view: (await this.repo.getView(tx, requestId))! };
  }
}
