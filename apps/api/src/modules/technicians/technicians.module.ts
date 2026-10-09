import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { TechniciansController } from './technicians.controller';
import { TechniciansService } from './technicians.service';

/** Technician availability and location samples (latest position and presence in Redis; last trusted fix in PostGIS). */
@Module({
  imports: [RealtimeModule],
  controllers: [TechniciansController],
  providers: [TechniciansService],
  exports: [TechniciansService],
})
export class TechniciansModule {}
