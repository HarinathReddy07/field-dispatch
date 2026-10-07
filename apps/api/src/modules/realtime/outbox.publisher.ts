import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { Env } from '@dispatch/config';
import { EventEnvelope, SOCKET_SCHEMA_VERSION, SocketEventType } from '@dispatch/contracts';
import { APP_CONFIG } from '../../config/config.module';
import { PrismaService } from '../../infra/prisma.service';
import { RealtimeGateway } from './realtime.gateway';

interface OutboxRow {
  seq: number;
  event_id: string;
  type: SocketEventType;
  request_id: string | null;
  rooms: string[];
  payload: Record<string, unknown>;
  occurred_at: Date;
}

/**
 * Delivers outbox rows to sockets AFTER the business transaction committed (rows only become visible then).
 * Rows are claimed with FOR UPDATE SKIP LOCKED, so any number of API instances can run this loop; the
 * Redis adapter fans the emit out to sockets on every instance. Delivery is at-least-once; clients de-dupe
 * on `eventId` and order on `seq`.
 */
@Injectable()
export class OutboxPublisher implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisher.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
    @Inject(APP_CONFIG) private readonly cfg: Env,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.cfg.BACKGROUND_JOBS) return;
    this.timer = setInterval(() => {
      this.runOnce().catch((e) =>
        this.logger.error(`outbox publish failed: ${e instanceof Error ? e.message : String(e)}`),
      );
    }, this.cfg.OUTBOX_POLL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const published = await this.prisma.tx(async (tx) => {
        const rows = await tx.$queryRaw<OutboxRow[]>`
          SELECT seq::int AS seq, event_id::text AS event_id, type, request_id::text AS request_id,
                 rooms, payload, occurred_at
          FROM outbox_events WHERE published_at IS NULL
          ORDER BY seq LIMIT 100 FOR UPDATE SKIP LOCKED`;
        for (const r of rows) {
          const envelope: EventEnvelope = {
            eventId: r.event_id,
            occurredAt: r.occurred_at.toISOString(),
            schemaVersion: SOCKET_SCHEMA_VERSION,
            seq: r.seq,
            type: r.type,
            requestId: r.request_id,
            data: r.payload,
          };
          this.gateway.publish(envelope, r.rooms);
        }
        if (rows.length > 0) {
          await tx.$executeRaw`UPDATE outbox_events SET published_at = now() WHERE seq = ANY(${rows.map((r) => r.seq)}::bigint[])`;
        }
        return rows;
      });
      for (const r of published) {
        const to = (r.payload as { to?: string }).to;
        const terminal = r.type === 'request.state.changed' && (to === 'SETTLED' || to === 'CANCELLED');
        if (r.request_id && (r.type === 'admin.override' || r.type === 'assignment.created' || terminal)) {
          await this.gateway.revalidateRequestRoom(r.request_id);
        }
      }
      return published.length;
    } finally {
      this.running = false;
    }
  }
}
