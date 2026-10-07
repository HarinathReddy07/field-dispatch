import { Prisma } from '@prisma/client';
import type { Category, RequestState } from '@dispatch/contracts';
import { Db } from './prisma.service';

/** Row shape for service_requests. Geography is exposed only as lat/lon (never selected raw). */
export interface RequestRow {
  id: string;
  requester_id: string;
  category: Category;
  asset_id: string;
  lat: number;
  lon: number;
  window_start: Date;
  window_end: Date;
  notes: string | null;
  state: RequestState;
  quote_minor: number | null;
  version: number;
  work_cycle: number;
  started_at: Date | null;
  review_deadline_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const REQUEST_COLS = Prisma.sql`
  r.id::text AS id, r.requester_id::text AS requester_id, r.category, r.asset_id,
  ST_Y(r.location::geometry) AS lat, ST_X(r.location::geometry) AS lon,
  r.window_start, r.window_end, r.notes, r.state, r.quote_minor, r.version, r.work_cycle,
  r.started_at, r.review_deadline_at, r.created_at, r.updated_at`;

/** SELECT ... FOR UPDATE: the first step of every critical section on a request. */
export async function lockRequest(db: Db, id: string): Promise<RequestRow | null> {
  const rows = await db.$queryRaw<RequestRow[]>(
    Prisma.sql`SELECT ${REQUEST_COLS} FROM service_requests r WHERE r.id = ${id}::uuid FOR UPDATE`,
  );
  return rows[0] ?? null;
}

export async function activeTechnicianId(db: Db, requestId: string): Promise<string | null> {
  const rows = await db.$queryRaw<{ technician_id: string }[]>`
    SELECT technician_id::text AS technician_id FROM assignments WHERE request_id = ${requestId}::uuid AND status = 'ACTIVE'`;
  return rows[0]?.technician_id ?? null;
}
