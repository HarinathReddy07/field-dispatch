import { Injectable } from '@nestjs/common';
import { AppException } from '../common/app-exception';
import { requestHash } from '../domain/hash';
import { Tx } from './prisma.service';

export interface IdempotencyInput {
  userId: string;
  method: string;
  route: string;
  resourceId: string;
  key: string;
  body: unknown;
}

interface StoredRow {
  request_hash: string;
  response_body: unknown;
}

/**
 * Idempotent execution inside the caller's transaction.
 *
 * The key row is inserted in the SAME transaction as the business change. Concurrent calls with the
 * same (scope, key) block on the unique index until the first commits, then replay its stored
 * result; if the first rolls back, the second simply executes. DB uniqueness is therefore the
 * backstop, and a stored result can never exist without its business change (or vice versa).
 * Failed (rolled-back) attempts store nothing, so retrying a failure re-evaluates it.
 */
@Injectable()
export class IdempotencyService {
  async run<T>(tx: Tx, input: IdempotencyInput, fn: () => Promise<T>): Promise<T> {
    const scope = `${input.userId}:${input.method} ${input.route}:${input.resourceId}`;
    const hash = requestHash(input.body);
    const inserted = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO idempotency_keys (scope, key, request_hash, response_status)
      VALUES (${scope}, ${input.key}, ${hash}, 0)
      ON CONFLICT (scope, key) DO NOTHING
      RETURNING id::text`;

    if (inserted.length === 0) {
      const rows = await tx.$queryRaw<StoredRow[]>`
        SELECT request_hash, response_body FROM idempotency_keys WHERE scope = ${scope} AND key = ${input.key}`;
      const existing = rows[0];
      if (!existing) throw new AppException('IDEMPOTENCY_IN_PROGRESS');
      if (existing.request_hash !== hash) throw new AppException('IDEMPOTENCY_MISMATCH');
      return existing.response_body as T;
    }

    const result = await fn();
    await tx.$executeRaw`
      UPDATE idempotency_keys SET response_status = 200, response_body = ${JSON.stringify(result)}::jsonb
      WHERE id = ${inserted[0]!.id}::uuid`;
    return result;
  }
}
