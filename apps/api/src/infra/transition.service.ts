import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  Actor,
  RequestState,
  TransitionAction,
  TransitionFailure,
  evaluateTransition,
  rooms,
} from '@dispatch/contracts';
import { AppException } from '../common/app-exception';
import { currentCorrelationId } from '../common/context';
import { AuditService } from './audit.service';
import { OutboxService } from './outbox.service';
import { Tx } from './prisma.service';
import { RequestRow, lockRequest } from './request-sql';

export interface TransitionInput {
  requestId: string;
  action: TransitionAction;
  actor: { id: string | null; role: Actor };
  reason?: string | null;
  /** Extra `column = value` assignments applied in the same UPDATE (e.g. quote_minor, started_at). */
  set?: Prisma.Sql[];
  metadata?: Record<string, unknown>;
  /** Additional users who must be notified (e.g. the technician being replaced). */
  notifyUserIds?: string[];
}

export interface TransitionOutcome {
  from: RequestState;
  to: RequestState;
  version: number;
  /** The locked row as it was BEFORE the transition. */
  before: RequestRow;
}

const FAILURE_MAP: Record<
  TransitionFailure,
  (state: RequestState, action: TransitionAction) => AppException
> = {
  ILLEGAL_TRANSITION: (state, action) =>
    new AppException('ILLEGAL_TRANSITION', `Action ${action} is not allowed while the request is ${state}`),
  FORBIDDEN_ACTOR: () => new AppException('FORBIDDEN'),
  REASON_REQUIRED: () => new AppException('VALIDATION_FAILED', 'A reason is required for this action'),
};

/**
 * The ONLY code path that changes service_requests.state. In one transaction it:
 * locks the row, asks the pure state machine, version-checks the UPDATE, appends job_event +
 * audit_log, and enqueues `request.state.changed` in the outbox (delivered after COMMIT).
 */
@Injectable()
export class TransitionService {
  constructor(
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async apply(tx: Tx, input: TransitionInput): Promise<TransitionOutcome> {
    const before = await lockRequest(tx, input.requestId);
    if (!before) throw new AppException('NOT_FOUND');

    const decision = evaluateTransition(before.state, input.action, input.actor.role, input.reason);
    if (!decision.ok) throw FAILURE_MAP[decision.error](before.state, input.action);
    const to = decision.rule.to;

    const sets = [
      Prisma.sql`state = ${to}`,
      Prisma.sql`version = version + 1`,
      Prisma.sql`updated_at = now()`,
      ...(input.set ?? []),
    ];
    const updated = await tx.$queryRaw<{ version: number }[]>(
      Prisma.sql`UPDATE service_requests SET ${Prisma.join(sets, ', ')}
                 WHERE id = ${input.requestId}::uuid AND version = ${before.version} RETURNING version`,
    );
    if (updated.length === 0) throw new AppException('STATE_CONFLICT'); // stale write can never overwrite a newer transition
    const version = updated[0]!.version;

    const reason = input.reason?.trim() || null;
    await tx.$executeRaw`
      INSERT INTO job_events (request_id, state_from, state_to, action, actor_id, actor_role, reason, metadata, correlation_id)
      VALUES (${input.requestId}::uuid, ${before.state}, ${to}, ${input.action}, ${input.actor.id}::uuid, ${input.actor.role},
              ${reason}, ${JSON.stringify(input.metadata ?? {})}::jsonb, ${currentCorrelationId()})`;
    await this.audit.record(tx, {
      actorId: input.actor.id,
      actorRole: input.actor.role,
      action: `request.${input.action.toLowerCase()}`,
      entityType: 'service_request',
      entityId: input.requestId,
      requestId: input.requestId,
      metadata: { from: before.state, to, version, ...(reason ? { reason } : {}), ...(input.metadata ?? {}) },
    });

    const tech = await tx.$queryRaw<{ technician_id: string }[]>`
      SELECT technician_id::text AS technician_id FROM assignments WHERE request_id = ${input.requestId}::uuid AND status = 'ACTIVE'`;
    const audience = [
      rooms.request(input.requestId),
      rooms.user(before.requester_id),
      rooms.admin,
      ...tech.map((t) => rooms.user(t.technician_id)),
      ...(input.notifyUserIds ?? []).map(rooms.user),
    ];
    await this.outbox.enqueue(tx, 'request.state.changed', input.requestId, audience, {
      requestId: input.requestId,
      from: before.state,
      to,
      version,
    });
    return { from: before.state, to, version, before };
  }
}
