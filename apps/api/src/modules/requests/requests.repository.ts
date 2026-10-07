import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  EventEnvelope,
  RequestView,
  SOCKET_SCHEMA_VERSION,
  SettlementStatus,
  SocketEventType,
} from '@dispatch/contracts';
import type { CreateRequestDto } from '@dispatch/contracts';
import { Db } from '../../infra/prisma.service';
import { REQUEST_COLS, RequestRow } from '../../infra/request-sql';

type ViewRow = RequestRow & {
  technician: { id: string; name: string; rating: number } | null;
  settlement: { amount_minor: number; status: SettlementStatus; provider_ref: string } | null;
};

const VIEW_SELECT = Prisma.sql`
  ${REQUEST_COLS},
  (SELECT row_to_json(x) FROM (
     SELECT u.id::text AS id, u.name, u.rating::float8 AS rating
     FROM assignments a JOIN users u ON u.id = a.technician_id
     WHERE a.request_id = r.id
     ORDER BY (a.status = 'ACTIVE') DESC, a.confirmed_at DESC LIMIT 1) x) AS technician,
  (SELECT row_to_json(s) FROM (
     SELECT amount_minor, status, provider_ref FROM settlements WHERE request_id = r.id) s) AS settlement`;

export function toView(row: ViewRow): RequestView {
  return {
    id: row.id,
    assetId: row.asset_id,
    category: row.category,
    location: { lat: row.lat, lon: row.lon },
    windowStart: row.window_start.toISOString(),
    windowEnd: row.window_end.toISOString(),
    notes: row.notes,
    state: row.state,
    version: row.version,
    workCycle: row.work_cycle,
    quoteMinor: row.quote_minor,
    startedAt: row.started_at?.toISOString() ?? null,
    reviewDeadlineAt: row.review_deadline_at?.toISOString() ?? null,
    technician: row.technician,
    settlement: row.settlement
      ? {
          amountMinor: row.settlement.amount_minor,
          status: row.settlement.status,
          providerRef: row.settlement.provider_ref,
        }
      : null,
    serverTime: new Date().toISOString(),
  };
}

@Injectable()
export class RequestsRepository {
  async insert(
    db: Db,
    requesterId: string,
    dto: Pick<CreateRequestDto, 'assetId' | 'category' | 'location' | 'windowStart' | 'windowEnd' | 'notes'>,
    reorderOf: string | null = null,
  ): Promise<string> {
    const rows = await db.$queryRaw<{ id: string }[]>`
      INSERT INTO service_requests (requester_id, category, asset_id, location, window_start, window_end, notes, reorder_of)
      VALUES (${requesterId}::uuid, ${dto.category}, ${dto.assetId},
              ST_SetSRID(ST_MakePoint(${dto.location.lon}::float8, ${dto.location.lat}::float8), 4326)::geography,
              ${dto.windowStart}::timestamptz, ${dto.windowEnd}::timestamptz, ${dto.notes ?? null}, ${reorderOf}::uuid)
      RETURNING id::text AS id`;
    return rows[0]!.id;
  }

  async getView(db: Db, id: string): Promise<RequestView | null> {
    const rows = await db.$queryRaw<ViewRow[]>(
      Prisma.sql`SELECT ${VIEW_SELECT} FROM service_requests r WHERE r.id = ${id}::uuid`,
    );
    return rows[0] ? toView(rows[0]) : null;
  }

  async getRaw(db: Db, id: string): Promise<RequestRow | null> {
    const rows = await db.$queryRaw<RequestRow[]>(
      Prisma.sql`SELECT ${REQUEST_COLS} FROM service_requests r WHERE r.id = ${id}::uuid`,
    );
    return rows[0] ?? null;
  }

  async listViews(db: Db, where: Prisma.Sql, limit: number, offset: number): Promise<RequestView[]> {
    const rows = await db.$queryRaw<ViewRow[]>(
      Prisma.sql`SELECT ${VIEW_SELECT} FROM service_requests r WHERE ${where}
                 ORDER BY r.updated_at DESC, r.id LIMIT ${limit}::int OFFSET ${offset}::int`,
    );
    return rows.map(toView);
  }

  async countWhere(db: Db, where: Prisma.Sql): Promise<number> {
    const rows = await db.$queryRaw<{ n: number }[]>(
      Prisma.sql`SELECT count(*)::int AS n FROM service_requests r WHERE ${where}`,
    );
    return rows[0]!.n;
  }

  /** Outbox events visible to a recipient (their user room, or the admin room) after `since`. */
  async eventsSince(
    db: Db,
    requestId: string,
    recipientRoom: string,
    since: number,
  ): Promise<EventEnvelope[]> {
    const rows = await db.$queryRaw<
      {
        seq: number;
        event_id: string;
        type: SocketEventType;
        request_id: string;
        payload: Record<string, unknown>;
        occurred_at: Date;
      }[]
    >`
      SELECT seq::int AS seq, event_id::text AS event_id, type, request_id::text AS request_id, payload, occurred_at
      FROM outbox_events
      WHERE request_id = ${requestId}::uuid AND seq > ${since}::bigint AND rooms @> ARRAY[${recipientRoom}]::text[]
      ORDER BY seq`;
    return rows.map((r) => ({
      eventId: r.event_id,
      occurredAt: r.occurred_at.toISOString(),
      schemaVersion: SOCKET_SCHEMA_VERSION,
      seq: r.seq,
      type: r.type,
      requestId: r.request_id,
      data: r.payload,
    }));
  }
}
