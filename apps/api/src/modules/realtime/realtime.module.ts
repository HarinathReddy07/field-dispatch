import { Module } from '@nestjs/common';
import { RequestsModule } from '../requests/requests.module';
import { OutboxPublisher } from './outbox.publisher';
import { RealtimeGateway } from './realtime.gateway';
import { REALTIME_PUBLISHER } from './realtime.tokens';

@Module({
  imports: [RequestsModule],
  providers: [
    RealtimeGateway,
    OutboxPublisher,
    { provide: REALTIME_PUBLISHER, useExisting: RealtimeGateway },
  ],
  exports: [RealtimeGateway, OutboxPublisher, REALTIME_PUBLISHER],
})
export class RealtimeModule {}
