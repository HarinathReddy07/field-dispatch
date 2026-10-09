import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/**
 * Immutable operational trace. AuditService can only INSERT; UPDATE/DELETE/TRUNCATE on the underlying tables
 * are rejected by database triggers (migration 0004). Global so every module can record events without importing it.
 */
@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
