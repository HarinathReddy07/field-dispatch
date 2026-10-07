import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Env } from '@dispatch/config';
import { RequestView, ReviewDto, rooms } from '@dispatch/contracts';
import { AppException } from '../../common/app-exception';
import { AuthUser } from '../../common/decorators';
import { APP_CONFIG } from '../../config/config.module';
import { REQUIRED_EVIDENCE_COUNT } from '../../domain/media';
import { AuditService } from '../../infra/audit.service';
import { IdempotencyService } from '../../infra/idempotency.service';
import { OutboxService } from '../../infra/outbox.service';
import { PrismaService, Tx } from '../../infra/prisma.service';
import { lockRequest } from '../../infra/request-sql';
import { TransitionService } from '../../infra/transition.service';
import { RequestsRepository } from '../requests/requests.repository';
import { AssignmentsService } from './assignments.service';
import { SettlementService } from './settlement.service';

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

  /** ARRIVED -> IN_PROGRESS, or REWORK_REQUESTED -> IN_PROGRESS (new work cycle). Start time is the DB clock. */
  start(user: AuthUser, requestId: string, key: string): Promise<RequestView> {
    return this.run(user, '/requests/:id/start', requestId, key, {}, async (tx) => {
      const row = await this.lockForTechnician(tx, user, requestId);
      const restart = row.state === 'REWORK_REQUESTED';
      const set = [Prisma.sql`started_at = now()`, Prisma.sql`review_deadline_at = NULL`];
      if (restart) set.push(Prisma.sql`work_cycle = work_cycle + 1`);
      await this.transitions.apply(tx, {
        requestId,
        action: restart ? 'RESTART_WORK' : 'START',
        actor: { id: user.id, role: 'TECHNICIAN' },
        set,
      });
      return (await this.repo.getView(tx, requestId))!;
    });
  }

  /** IN_PROGRESS -> UNDER_REVIEW, gated on >= 2 finalized images in the CURRENT work cycle. */
  stop(user: AuthUser, requestId: string, key: string): Promise<RequestView> {
    return this.run(user, '/requests/:id/stop', requestId, key, {}, async (tx) => {
      const row = await this.lockForTechnician(tx, user, requestId);
      if (row.state === 'IN_PROGRESS') {
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
        metadata: { workCycle: row.work_cycle },
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
        workCycle: row.work_cycle,
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
    return (await this.repo.getView(tx, requestId))!;
  }

  /** Requester cancels before work starts. */
  cancel(user: AuthUser, requestId: string, key: string): Promise<RequestView> {
    return this.run(user, '/requests/:id/cancel', requestId, key, {}, async (tx) => {
      const row = await lockRequest(tx, requestId);
      if (!row || row.requester_id !== user.id) throw new AppException('NOT_FOUND');
      await this.transitions.apply(tx, {
        requestId,
        action: 'CANCEL',
        actor: { id: user.id, role: 'REQUESTER' },
      });
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
