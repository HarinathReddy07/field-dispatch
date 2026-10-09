import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Env } from '@dispatch/config';
import { rooms } from '@dispatch/contracts';
import { AppException } from '../../common/app-exception';
import { AuthUser } from '../../common/decorators';
import { APP_CONFIG } from '../../config/config.module';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';
import { AuditService } from '../audit/audit.service';
import { REALTIME_PUBLISHER, RealtimePublisher } from '../realtime/realtime.tokens';

@Injectable()
export class TechniciansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly cfg: Env,
    @Optional() @Inject(REALTIME_PUBLISHER) private readonly realtime?: RealtimePublisher,
  ) {}

  /** A technician holding an active job is BUSY and cannot toggle availability. */
  async setAvailability(user: AuthUser, status: 'AVAILABLE' | 'OFFLINE') {
    const rows = await this.prisma.$queryRaw<{ availability_status: string }[]>`
      UPDATE technicians
      SET availability_status = ${status},
          last_seen_at = CASE WHEN ${status} = 'AVAILABLE' THEN now() ELSE last_seen_at END
      WHERE user_id = ${user.id}::uuid AND availability_status <> 'BUSY'
      RETURNING availability_status`;
    if (rows.length === 0) {
      const exists = await this.prisma.technician.findUnique({
        where: { userId: user.id },
        select: { userId: true },
      });
      if (!exists) throw new AppException('NOT_FOUND');
      throw new AppException('STATE_CONFLICT', 'Availability cannot be changed during an active job');
    }
    await this.audit.record(this.prisma, {
      actorId: user.id,
      actorRole: 'TECHNICIAN',
      action: 'technician.availability',
      entityType: 'technician',
      entityId: user.id,
      metadata: { status },
    });
    return { status: rows[0]!.availability_status };
  }

  /**
   * Location sample ingestion. Latest position + presence live in Redis with a TTL; Postgres only gets
   * a throttled "last trusted location" (needed for matching/audit). Only the active job's room and
   * admins receive the live event.
   */
  async ingestLocation(user: AuthUser, lat: number, lon: number) {
    const at = new Date().toISOString();
    await this.redis.client
      .multi()
      .set(`loc:${user.id}`, JSON.stringify({ lat, lon, at }), 'EX', 120)
      .set(`presence:${user.id}`, '1', 'EX', 90)
      .exec();

    const gate = await this.redis.client.set(
      `locpersist:${user.id}`,
      '1',
      'EX',
      this.cfg.LOCATION_PERSIST_INTERVAL_SECONDS,
      'NX',
    );
    const persisted = gate === 'OK';
    if (persisted) {
      await this.prisma.$executeRaw`
        UPDATE technicians SET location = ST_SetSRID(ST_MakePoint(${lon}::float8, ${lat}::float8), 4326)::geography,
                               last_seen_at = now()
        WHERE user_id = ${user.id}::uuid`;
    }

    const active = await this.prisma.$queryRaw<{ request_id: string }[]>`
      SELECT request_id::text AS request_id FROM assignments WHERE technician_id = ${user.id}::uuid AND status = 'ACTIVE'`;
    if (active[0] && this.realtime) {
      this.realtime.publishEphemeral(
        'technician.location.updated',
        active[0].request_id,
        [rooms.request(active[0].request_id), rooms.admin],
        {
          requestId: active[0].request_id,
          technicianId: user.id,
          lat,
          lon,
          at,
        },
      );
    }
    return { accepted: true, persisted };
  }
}
