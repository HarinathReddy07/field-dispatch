import { Module } from '@nestjs/common';
import type { Env } from '@dispatch/config';
import { APP_CONFIG } from '../../config/config.module';
import { RequestsModule } from '../requests/requests.module';
import { AssignmentsService } from './assignments.service';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { MediaService } from './media.service';
import { OtpService } from './otp.service';
import { MockPaymentProvider, PAYMENT_PROVIDER } from './payment/payment.provider';
import { SettlementService } from './settlement.service';
import { MemoryStorageProvider } from './storage/memory.storage';
import { MinioStorageProvider } from './storage/minio.storage';
import { STORAGE_PROVIDER } from './storage/storage.provider';
import { SweeperService } from './sweeper.service';

@Module({
  imports: [RequestsModule],
  controllers: [JobsController],
  providers: [
    AssignmentsService,
    OtpService,
    MediaService,
    SettlementService,
    JobsService,
    SweeperService,
    { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider }, // MOCK: no real payment gateway in the trial
    {
      provide: STORAGE_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (cfg: Env) =>
        cfg.STORAGE_PROVIDER === 'memory' ? new MemoryStorageProvider() : new MinioStorageProvider(cfg),
    },
  ],
  exports: [AssignmentsService, JobsService, MediaService, SweeperService, STORAGE_PROVIDER],
})
export class JobsModule {}
