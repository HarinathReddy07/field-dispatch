import { Module } from '@nestjs/common';
import { DispatchModule } from '../dispatch/dispatch.module';
import { JobsModule } from '../jobs/jobs.module';
import { MediaModule } from '../media/media.module';
import { RequestsModule } from '../requests/requests.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/** Operational queries and privileged commands. Goes through the same transition service, so it cannot bypass state rules. */
@Module({
  imports: [RequestsModule, JobsModule, DispatchModule, MediaModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
