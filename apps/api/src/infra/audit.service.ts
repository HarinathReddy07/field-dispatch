import { Injectable } from '@nestjs/common';
import { currentCorrelationId } from '../common/context';
import { Db } from './prisma.service';

export interface AuditEntry {
  actorId: string | null;
  actorRole: 'REQUESTER' | 'TECHNICIAN' | 'ADMIN' | 'SYSTEM' | 'ANONYMOUS';
  action: string;
  entityType: string;
  entityId: string;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Writes append-only audit rows (the table's trigger blocks UPDATE/DELETE). Never pass secrets in metadata. */
@Injectable()
export class AuditService {
  async record(db: Db, e: AuditEntry): Promise<void> {
    await db.$executeRaw`
      INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, request_id, correlation_id, metadata)
      VALUES (${e.actorId}::uuid, ${e.actorRole}, ${e.action}, ${e.entityType}, ${e.entityId},
              ${e.requestId ?? null}::uuid, ${currentCorrelationId()}, ${JSON.stringify(e.metadata ?? {})}::jsonb)`;
  }
}
