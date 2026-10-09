import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Env } from '@dispatch/config';
import { RequestView, ReviewDto, rooms } from '@dispatch/contracts';
import { AppException } from '../../common/app-exception';
import { AuthUser } from '../../common/decorators';
import { APP_CONFIG } from '../../config/config.module';
import { REQUIRED_EVIDENCE_COUNT } from '../../domain/media';
import { AuditService } from '../audit/audit.service';
import { IdempotencyService } from '../../infra/idempotency.service';
import { OutboxService } from '../../infra/outbox.service';
import { PrismaService, Tx } from '../../infra/prisma.service';
import { lockRequest } from '../../infra/request-sql';
import { TransitionService } from '../../infra/transition.service';
import { RequestsRepository } from '../requests/requests.repository';
import { AssignmentsService } from '../dispatch/assignments.service';
import { SettlementService } from '../settlement/settlement.service';

type Actor = { id: string | null; role: 'REQUESTER' | 'TECHNICIAN' | 'SYSTEM' };

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transitions: TransitionService,
    private readonly idempotency: IdempotencyService,
    private readonly repo: RequestsRepository,
    private readonly assignments: AssignmentsService,
    private readonly settlements: SettlementService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    @Inject(APP_CONFIG) private readonly cfg: Env,
  ) {}

  private run<T>(
    user: AuthUser,
    route: string,
    requestId: string,
    key: string,
    body: unknown,
    fn: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    return this.prisma.tx((tx) =>
      this.idempotency.run(
        tx,
        { userId: user.id, method: 'POST', route, resourceId: requestId, key, body },
        () => fn(tx),
      ),
    );
  }

  /** Locks the request and 404s unless the caller is its active technician (no existence leak). */
  private async lockForTechnician(tx: Tx, user: AuthUser, requestId: string) {
    const row = await lockRequest(tx, requestId);
    if (!row || !(await this.assignments.isActiveAssignee(tx, requestId, user.id)))
      throw new AppException('NOT_FOUND');
    return row;
  }

  /** ARRIVED -> IN_PROGRESS. The start time is the database clock, never the client's. */
  start(user: AuthUser, requestId: string, key: string): Promise<RequestView> {
    return this.run(user, '/requests/:id/start', requestId, key, {}, async (tx) => {
      await this.lockForTechnician(tx, user, requestId);
      await this.transitions.apply(tx, {
        requestId,
        action: 'START',
        actor: { id: user.id, role: 'TECHNICIAN' },
        set: [Prisma.sql`started_at = now()`, Prisma.sql`review_deadline_at = NULL`],
      });
      return (await this.repo.getView(tx, requestId))!;
    });
  }

  /**
   * IN_PROGRESS | REWORK -> PROOF_UPLOADED -> UNDER_REVIEW, gated on >= 2 finalized images in the
   * CURRENT work cycle (a rework request opens a new cycle, so earlier proofs never count).
   */
  stop(user: AuthUser, requestId: string, key: string): Promise<RequestView> {
    return this.run(user, '/requests/:id/stop', requestId, key, {}, async (tx) => {
      const row = await this.lockForTechnician(tx, user, requestId);
      if (row.state === 'IN_PROGRESS' || row.state === 'REWORK') {
        const counted = await tx.$queryRaw<{ n: number }[]>`
          SELECT count(*)::int AS n FROM evidence_media
          WHERE request_id = ${requestId}::uuid AND work_cycle = ${row.work_cycle}::int AND status = 'FINALIZED'`;
        const finalized = counted[0]!.n;
        if (finalized < REQUIRED_EVIDENCE_COUNT) {
          throw new AppException('EVIDENCE_REQUIRED', undefined, {
            required: REQUIRED_EVIDENCE_COUNT,
            finalized,
          });
        }
      }
      await this.transitions.apply(tx, {
        requestId,
        action: 'STOP',
        actor: { id: user.id, role: 'TECHNICIAN' },
        metadata: { workCycle: row.work_cycle },
      });
      await this.transitions.apply(tx, {
        requestId,
        action: 'SUBMIT_REVIEW',
        actor: { id: user.id, role: 'TECHNICIAN' },
        // The review deadline is persisted; the sweeper (not a process timer) enforces it.
        set: [
          Prisma.sql`review_deadline_at = now() + make_interval(secs => ${this.cfg.REVIEW_TIMEOUT_SECONDS}::float8)`,
        ],
        metadata: { workCycle: row.work_cycle },
      });
      return (await this.repo.getView(tx, requestId))!;
    });
  }

  /** APPROVE completes + settles; REQUEST_REWORK returns the job to the technician and keeps all history. */
  review(user: AuthUser, requestId: string, dto: ReviewDto, key: string): Promise<RequestView> {
    return this.run(user, '/requests/:id/review', requestId, key, dto, async (tx) => {
      const row = await lockRequest(tx, requestId);
      if (!row || row.requester_id !== user.id) throw new AppException('NOT_FOUND');
      const actor: Actor = { id: user.id, role: 'REQUESTER' };
      if (dto.decision === 'APPROVE') return this.completeIn(tx, requestId, 'APPROVE', actor);

      const tech = await this.assignments.activeTechnician(tx, requestId);
      await this.transitions.apply(tx, {
        requestId,
        action: 'REQUEST_REWORK',
        actor: { id: user.id, role: 'REQUESTER' },
        reason: dto.reason,
        // A rework opens a NEW work cycle: its proofs are counted separately and earlier ones are kept.
        set: [Prisma.sql`work_cycle = work_cycle + 1`, Prisma.sql`review_deadline_at = NULL`],
        metadata: { workCycle: row.work_cycle, nextWorkCycle: row.work_cycle + 1 },
      });
      const audience = [
        rooms.admin,
        rooms.user(user.id),
        rooms.request(requestId),
        ...(tech ? [rooms.user(tech.technicianId)] : []),
      ];
      await this.outbox.enqueue(tx, 'review.requested', requestId, audience, {
        requestId,
        reason: dto.reason!,
        workCycle: row.work_cycle + 1,
      });
      return (await this.repo.getView(tx, requestId))!;
    });
  }

  /**
   * The single completion path, used by manual approval AND the timeout sweeper:
   * transition + end assignment + free technician + exactly one settlement, all in one transaction.
   */
  async completeIn(
    tx: Tx,
    requestId: string,
    action: 'APPROVE' | 'AUTO_APPROVE',
    actor: Actor,
  ): Promise<RequestView> {
    const outcome = await this.transitions.apply(tx, {
      requestId,
      action,
      actor,
      set: [Prisma.sql`review_deadline_at = NULL`],
      metadata: action === 'AUTO_APPROVE' ? { reason: 'review timeout' } : {},
    });
    await this.assignments.endActive(tx, requestId, 'COMPLETED');
    await this.settlements.createFor(tx, {
      requestId,
      requesterId: outcome.before.requester_id,
      amountMinor: outcome.before.quote_minor!, // server-held quote
      actor: { id: actor.id, role: actor.role === 'SYSTEM' ? 'SYSTEM' : 'REQUESTER' },
    });
    // COMPLETED -> SETTLED in the same transaction: the mock ledger row exists, so the job is settled.
    await this.transitions.apply(tx, {
      requestId,
      action: 'SETTLE',
      actor: { id: null, role: 'SYSTEM' },
      metadata: { amountMinor: outcome.before.quote_minor },
    });
    return (await this.repo.getView(tx, requestId))!;
  }

  /**
   * Requester cancel. With a technician booked (CONFIRMED) the booking is released and the request
   * returns to REQUESTED; before that the request is cancelled outright.
   */
  cancel(user: AuthUser, requestId: string, key: string): Promise<RequestView> {
    return this.run(user, '/requests/:id/cancel', requestId, key, {}, async (tx) => {
      const row = await lockRequest(tx, requestId);
      if (!row || row.requester_id !== user.id) throw new AppException('NOT_FOUND');
      const releasing = row.state === 'CONFIRMED';
      await this.transitions.apply(tx, {
        requestId,
        action: releasing ? 'CANCEL_ASSIGNMENT' : 'CANCEL',
        actor: { id: user.id, role: 'REQUESTER' },
        set: releasing ? [Prisma.sql`quote_minor = NULL`] : [],
      });
      if (releasing) {
        await tx.$executeRaw`
          UPDATE otp_challenges SET superseded_at = now()
          WHERE request_id = ${requestId}::uuid AND consumed_at IS NULL AND superseded_at IS NULL`;
      }
      await this.assignments.endActive(tx, requestId, 'CANCELLED', 'cancelled by requester');
      await this.audit.record(tx, {
        actorId: user.id,
        actorRole: 'REQUESTER',
        action: 'request.cancelled',
        entityType: 'service_request',
        entityId: requestId,
        requestId,
      });
      return (await this.repo.getView(tx, requestId))!;
    });
  }
}
