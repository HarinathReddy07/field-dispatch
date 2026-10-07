import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { RequestsModule } from '../requests/requests.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [RequestsModule, JobsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
