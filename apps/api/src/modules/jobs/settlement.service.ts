import { Inject, Injectable } from '@nestjs/common';
import { rooms } from '@dispatch/contracts';
import { AuditService } from '../../infra/audit.service';
import { OutboxService } from '../../infra/outbox.service';
import { Tx } from '../../infra/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment/payment.provider';

export interface SettlementResult {
  settlementId: string;
  amountMinor: number;
  providerRef: string;
  created: boolean;
}

@Injectable()
export class SettlementService {
  constructor(
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  ) {}

  /**
   * Exactly one settlement per request, created inside the completion transaction.
   * The amount is the server-held quote, never a client value. `idempotency_key` and
   * UNIQUE(request_id) make a duplicate impossible even if this were called twice.
   */
  async createFor(
    tx: Tx,
    input: {
      requestId: string;
      requesterId: string;
      amountMinor: number;
      actor: { id: string | null; role: 'REQUESTER' | 'SYSTEM' };
    },
  ): Promise<SettlementResult> {
    const idempotencyKey = `settle:${input.requestId}`;
    const captured = await this.payments.capture({
      requestId: input.requestId,
      amountMinor: input.amountMinor,
      idempotencyKey,
    });
    const inserted = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO settlements (request_id, amount_minor, idempotency_key, status, provider_ref)
      VALUES (${input.requestId}::uuid, ${input.amountMinor}::int, ${idempotencyKey}, ${captured.status}, ${captured.providerRef})
      ON CONFLICT (request_id) DO NOTHING
      RETURNING id::text AS id`;

    if (inserted.length === 0) {
      const existing = await tx.$queryRaw<{ id: string; amount_minor: number; provider_ref: string }[]>`
        SELECT id::text AS id, amount_minor, provider_ref FROM settlements WHERE request_id = ${input.requestId}::uuid`;
      return {
        settlementId: existing[0]!.id,
        amountMinor: existing[0]!.amount_minor,
        providerRef: existing[0]!.provider_ref,
        created: false,
      };
    }
    const settlementId = inserted[0]!.id;
    await this.audit.record(tx, {
      actorId: input.actor.id,
      actorRole: input.actor.role,
      action: 'settlement.create',
      entityType: 'settlement',
      entityId: settlementId,
      requestId: input.requestId,
      metadata: {
        amountMinor: input.amountMinor,
        providerRef: captured.providerRef,
        mock: this.payments.isMock,
      },
    });
    await this.outbox.enqueue(
      tx,
      'settlement.created',
      input.requestId,
      [rooms.user(input.requesterId), rooms.admin, rooms.request(input.requestId)],
      {
        requestId: input.requestId,
        settlementId,
        amountMinor: input.amountMinor,
        providerRef: captured.providerRef,
      },
    );
    return { settlementId, amountMinor: input.amountMinor, providerRef: captured.providerRef, created: true };
  }
}
