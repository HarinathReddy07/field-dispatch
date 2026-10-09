import { Module } from '@nestjs/common';
import { DispatchModule } from '../dispatch/dispatch.module';
import { MediaModule } from '../media/media.module';
import { OtpModule } from '../otp/otp.module';
import { RequestsModule } from '../requests/requests.module';
import { SettlementModule } from '../settlement/settlement.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { SweeperService } from './sweeper.service';

/** Arrival, start, stop, review, rework and the review-timeout sweeper. Orchestrates; the rules live in the modules it imports. */
@Module({
  imports: [RequestsModule, DispatchModule, OtpModule, MediaModule, SettlementModule],
  controllers: [JobsController],
  providers: [JobsService, SweeperService],
  exports: [JobsService, SweeperService],
})
export class JobsModule {}
