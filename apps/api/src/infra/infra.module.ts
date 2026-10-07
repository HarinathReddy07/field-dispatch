import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { IdempotencyService } from './idempotency.service';
import { OutboxService } from './outbox.service';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { TransitionService } from './transition.service';

@Global()
@Module({
  providers: [
    PrismaService,
    RedisService,
    AuditService,
    OutboxService,
    IdempotencyService,
    TransitionService,
  ],
  exports: [PrismaService, RedisService, AuditService, OutboxService, IdempotencyService, TransitionService],
})
export class InfraModule {}
