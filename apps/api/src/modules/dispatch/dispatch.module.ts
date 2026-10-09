import { Module } from '@nestjs/common';
import { RequestsModule } from '../requests/requests.module';
import { AssignmentsService } from './assignments.service';
import { DispatchController } from './dispatch.controller';
import { DispatchService } from './dispatch.service';

/** PostGIS candidate search, technician reservation and assignment. No UI-specific formatting. */
@Module({
  imports: [RequestsModule],
  controllers: [DispatchController],
  providers: [DispatchService, AssignmentsService],
  exports: [DispatchService, AssignmentsService],
})
export class DispatchModule {}
