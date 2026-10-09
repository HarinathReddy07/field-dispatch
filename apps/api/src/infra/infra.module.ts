import { Global, Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { OutboxService } from './outbox.service';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { TransitionService } from './transition.service';

@Global()
@Module({
  providers: [PrismaService, RedisService, OutboxService, IdempotencyService, TransitionService],
  exports: [PrismaService, RedisService, OutboxService, IdempotencyService, TransitionService],
})
export class InfraModule {}
