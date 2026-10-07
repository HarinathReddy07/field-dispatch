import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { EventPayloads, SocketEventType } from '@dispatch/contracts';
import { Tx } from './prisma.service';

type Payload<T extends SocketEventType> = z.infer<(typeof EventPayloads)[T]>;

/**
 * Transactional outbox: events are written in the same transaction as the business change and
 * delivered to sockets only after COMMIT by the OutboxPublisher (never emitted inline).
 */
@Injectable()
export class OutboxService {
  async enqueue<T extends SocketEventType>(
    tx: Tx,
    type: T,
    requestId: string,
    rooms: string[],
    data: Payload<T>,
  ): Promise<void> {
    const parsed = EventPayloads[type].parse(data); // contract check: bad payloads fail the transaction
    await tx.$executeRaw`
      INSERT INTO outbox_events (type, request_id, rooms, payload)
      VALUES (${type}, ${requestId}::uuid, ${Array.from(new Set(rooms))}::text[], ${JSON.stringify(parsed)}::jsonb)`;
  }
}
