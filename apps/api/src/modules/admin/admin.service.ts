import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Env } from '@dispatch/config';
import { AdminAuditQuery, AdminJobsQuery, RequestState, RequestView, rooms } from '@dispatch/contracts';
import { AppException } from '../../common/app-exception';
import { AuthUser } from '../../common/decorators';
import { APP_CONFIG } from '../../config/config.module';
import { computeExceptionFlags } from '../../domain/exceptions';
import { calculateQuote, metersToKm } from '../../domain/pricing';
import { AuditService } from '../../infra/audit.service';
import { OutboxService } from '../../infra/outbox.service';
import { PrismaService, Tx, pgCode } from '../../infra/prisma.service';
import { lockRequest } from '../../infra/request-sql';
import { TransitionService } from '../../infra/transition.service';
import { AssignmentsService } from '../jobs/assignments.service';
import { MediaService } from '../jobs/media.service';
import { RequestsRepository } from '../requests/requests.repository';

const ACTIVE_STATES: RequestState[] = [
  'CREATED',
  'MATCHING',
  'ASSIGNED',
  'ARRIVED',
  'IN_PROGRESS',
  'UNDER_REVIEW',
  'REWORK_REQUESTED',
];

interface LiveRow {
  request_id: string;
  last_seen_at: Date | null;
  lat: number | null;
  lon: number | null;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: RequestsRepository,
    private readonly transitions: TransitionService,
    private readonly assignments: AssignmentsService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    @Inject(APP_CONFIG) private readonly cfg: Env,
  ) {}

  /** Active technician's last trusted location for a set of requests. */
  private async liveRows(ids: string[]): Promise<Map<string, LiveRow>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<LiveRow[]>`
      SELECT a.request_id::text AS request_id, t.last_seen_at,
             ST_Y(t.location::geometry) AS lat, ST_X(t.location::geometry) AS lon
      FROM assignments a JOIN technicians t ON t.user_id = a.technician_id
      WHERE a.status = 'ACTIVE' AND a.request_id = ANY(${ids}::uuid[])`;
    return new Map(rows.map((r) => [r.request_id, r]));
  }

  private decorate(views: RequestView[], live: Map<string, LiveRow>, createdAt: Map<string, Date>) {
    const now = new Date();
    return views.map((v) => {
      const l = live.get(v.id);
      const flags = computeExceptionFlags({
        state: v.state,
        workCycle: v.workCycle,
        createdAt: createdAt.get(v.id) ?? now,
        reviewDeadlineAt: v.reviewDeadlineAt ? new Date(v.reviewDeadlineAt) : null,
        technicianLastSeenAt: l?.last_seen_at ?? null,
        now,
        freshnessSeconds: this.cfg.LOCATION_FRESHNESS_SECONDS,
      });
      return {
        ...v,
        exceptionFlags: flags,
        technicianLocation:
          l && l.lat !== null && l.lon !== null
            ? { lat: l.lat, lon: l.lon, lastSeenAt: l.last_seen_at?.toISOString() ?? null }
            : null,
        elapsedSeconds:
          v.startedAt && v.state === 'IN_PROGRESS'
            ? Math.floor((now.getTime() - Date.parse(v.startedAt)) / 1000)
            : null,
      };
    });
  }

  private async createdAtMap(ids: string[]): Promise<Map<string, Date>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<{ id: string; created_at: Date }[]>`
      SELECT id::text AS id, created_at FROM service_requests WHERE id = ANY(${ids}::uuid[])`;
    return new Map(rows.map((r) => [r.id, r.created_at]));
  }

  async jobs(q: AdminJobsQuery) {
    const where = q.state ? Prisma.sql`r.state = ${q.state}` : Prisma.sql`TRUE`;
    const [views, total] = await Promise.all([
      this.repo.listViews(this.prisma, where, q.pageSize, (q.page - 1) * q.pageSize),
      this.repo.countWhere(this.prisma, where),
    ]);
    const ids = views.map((v) => v.id);
    const [live, created] = await Promise.all([this.liveRows(ids), this.createdAtMap(ids)]);
    return { items: this.decorate(views, live, created), total, page: q.page, pageSize: q.pageSize };
  }

  async summary() {
    const counts = await this.prisma.$queryRaw<{ state: RequestState; n: number }[]>`
      SELECT state, count(*)::int AS n FROM service_requests GROUP BY state`;
    const countsByState = Object.fromEntries(counts.map((c) => [c.state, c.n])) as Partial<
      Record<RequestState, number>
    >;
    const activeViews = await this.repo.listViews(
      this.prisma,
      Prisma.sql`r.state IN (${Prisma.join(ACTIVE_STATES)})`,
      500,
      0,
    );
    const ids = activeViews.map((v) => v.id);
    const decorated = this.decorate(activeViews, await this.liveRows(ids), await this.createdAtMap(ids));
    const techs = await this.prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM technicians
      WHERE availability_status IN ('AVAILABLE', 'BUSY')
        AND last_seen_at >= now() - make_interval(secs => ${this.cfg.LOCATION_FRESHNESS_SECONDS}::float8)`;
    return {
      countsByState,
      activeRequests: activeViews.length,
      activeTechnicians: techs[0]!.n,
      exceptionCount: decorated.filter((d) => d.exceptionFlags.length > 0).length,
    };
  }

  async jobDetail(id: string) {
    const view = await this.repo.getView(this.prisma, id);
    if (!view) throw new AppException('NOT_FOUND');
    const [live, created, events, audit, assignments, evidence] = await Promise.all([
      this.liveRows([id]),
      this.createdAtMap([id]),
      this.prisma.$queryRaw<unknown[]>`
        SELECT seq::int AS seq, state_from, state_to, action, actor_id::text AS actor_id, actor_role, reason, metadata, occurred_at
        FROM job_events WHERE request_id = ${id}::uuid ORDER BY seq`,
      this.prisma.$queryRaw<unknown[]>`
        SELECT seq::int AS seq, actor_id::text AS actor_id, actor_role, action, entity_type, entity_id, metadata, created_at
        FROM audit_logs WHERE request_id = ${id}::uuid ORDER BY seq`,
      this.prisma.$queryRaw<unknown[]>`
        SELECT a.id::text AS id, a.technician_id::text AS technician_id, u.name AS technician_name, a.status,
               a.quote_minor, a.confirmed_at, a.ended_at, a.end_reason
        FROM assignments a JOIN users u ON u.id = a.technician_id
        WHERE a.request_id = ${id}::uuid ORDER BY a.confirmed_at`,
      this.media.listForRequest(this.prisma, id),
    ]);
    return { job: this.decorate([view], live, created)[0]!, events, audit, assignments, evidence };
  }

  async technicians() {
    return this.prisma.$queryRaw<unknown[]>`
      SELECT u.id::text AS id, u.name, u.rating::float8 AS rating, t.availability_status, t.service_categories,
             t.last_seen_at, ST_Y(t.location::geometry) AS lat, ST_X(t.location::geometry) AS lon,
             a.request_id::text AS current_request_id,
             (t.last_seen_at IS NOT NULL
              AND t.last_seen_at >= now() - make_interval(secs => ${this.cfg.LOCATION_FRESHNESS_SECONDS}::float8)) AS fresh
      FROM technicians t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN assignments a ON a.technician_id = t.user_id AND a.status = 'ACTIVE'
      ORDER BY u.name`;
  }

  async auditLog(q: AdminAuditQuery) {
    const conds: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (q.requestId) conds.push(Prisma.sql`request_id = ${q.requestId}::uuid`);
    if (q.actorId) conds.push(Prisma.sql`actor_id = ${q.actorId}::uuid`);
    if (q.action) conds.push(Prisma.sql`action = ${q.action}`);
    const where = Prisma.join(conds, ' AND ');
    const [items, total] = await Promise.all([
      this.prisma.$queryRaw<unknown[]>(Prisma.sql`
        SELECT seq::int AS seq, id::text AS id, actor_id::text AS actor_id, actor_role, action, entity_type, entity_id,
               request_id::text AS request_id, correlation_id, metadata, created_at
        FROM audit_logs WHERE ${where} ORDER BY seq DESC LIMIT ${q.pageSize}::int OFFSET ${(q.page - 1) * q.pageSize}::int`),
      this.prisma.$queryRaw<{ n: number }[]>(
        Prisma.sql`SELECT count(*)::int AS n FROM audit_logs WHERE ${where}`,
      ),
    ]);
    return { items, total: total[0]!.n, page: q.page, pageSize: q.pageSize };
  }

  /** Privileged reassignment. Goes through the same state machine (ADMIN_REASSIGN row) with a mandatory reason. */
  async reassign(
    admin: AuthUser,
    requestId: string,
    technicianId: string,
    reason: string,
  ): Promise<RequestView> {
    try {
      return await this.prisma.tx((tx) => this.reassignIn(tx, admin, requestId, technicianId, reason));
    } catch (e) {
      const code = pgCode(e);
      if (code === '23505' || code === '23P01') throw new AppException('TECHNICIAN_UNAVAILABLE');
      throw e;
    }
  }

  private async reassignIn(
    tx: Tx,
    admin: AuthUser,
    requestId: string,
    technicianId: string,
    reason: string,
  ): Promise<RequestView> {
    const req = await lockRequest(tx, requestId);
    if (!req) throw new AppException('NOT_FOUND');
    const current = await this.assignments.activeTechnician(tx, requestId);
    if (current?.technicianId === technicianId)
      throw new AppException('STATE_CONFLICT', 'The request is already assigned to this technician');

    const techRows = await tx.$queryRaw<
      { availability_status: string; service_categories: string[]; distance_m: number }[]
    >`
      SELECT t.availability_status, t.service_categories, ST_Distance(t.location, r.location) AS distance_m
      FROM technicians t
      JOIN users u ON u.id = t.user_id AND u.status = 'ACTIVE'
      JOIN service_requests r ON r.id = ${requestId}::uuid
      WHERE t.user_id = ${technicianId}::uuid AND t.location IS NOT NULL
      FOR UPDATE OF t`;
    const tech = techRows[0];
    if (
      !tech ||
      tech.availability_status !== 'AVAILABLE' ||
      !tech.service_categories.includes(req.category)
    ) {
      throw new AppException('TECHNICIAN_UNAVAILABLE');
    }

    if (current) await this.assignments.endActive(tx, requestId, 'REASSIGNED', reason);
    const quoteMinor = calculateQuote(req.category, metersToKm(tech.distance_m));
    const inserted = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO assignments (request_id, technician_id, status, time_window, quote_minor)
      VALUES (${requestId}::uuid, ${technicianId}::uuid, 'ACTIVE',
              tstzrange(${req.window_start}::timestamptz, ${req.window_end}::timestamptz, '[)'), ${quoteMinor}::int)
      RETURNING id::text AS id`;
    await tx.$executeRaw`UPDATE technicians SET availability_status = 'BUSY' WHERE user_id = ${technicianId}::uuid`;
    // The old arrival code must not work for the new technician.
    await tx.$executeRaw`
      UPDATE otp_challenges SET superseded_at = now()
      WHERE request_id = ${requestId}::uuid AND consumed_at IS NULL AND superseded_at IS NULL`;

    const set = [
      Prisma.sql`quote_minor = ${quoteMinor}`,
      Prisma.sql`started_at = NULL`,
      Prisma.sql`review_deadline_at = NULL`,
    ];
    if (req.state === 'IN_PROGRESS' || req.state === 'REWORK_REQUESTED')
      set.push(Prisma.sql`work_cycle = work_cycle + 1`);
    await this.transitions.apply(tx, {
      requestId,
      action: 'ADMIN_REASSIGN',
      actor: { id: admin.id, role: 'ADMIN' },
      reason,
      set,
      notifyUserIds: current ? [current.technicianId] : [],
      metadata: { fromTechnicianId: current?.technicianId ?? null, toTechnicianId: technicianId, quoteMinor },
    });

    const audience = [
      rooms.user(req.requester_id),
      rooms.user(technicianId),
      rooms.admin,
      rooms.request(requestId),
      ...(current ? [rooms.user(current.technicianId)] : []),
    ];
    await this.outbox.enqueue(tx, 'admin.override', requestId, audience, {
      requestId,
      action: 'REASSIGN',
      reason,
    });
    await this.outbox.enqueue(
      tx,
      'assignment.created',
      requestId,
      [rooms.user(req.requester_id), rooms.user(technicianId), rooms.admin, rooms.request(requestId)],
      {
        requestId,
        assignmentId: inserted[0]!.id,
        technicianId,
        quoteMinor,
      },
    );
    return (await this.repo.getView(tx, requestId))!;
  }

  async cancel(admin: AuthUser, requestId: string, reason: string): Promise<RequestView> {
    return this.prisma.tx(async (tx) => {
      const req = await lockRequest(tx, requestId);
      if (!req) throw new AppException('NOT_FOUND');
      const current = await this.assignments.activeTechnician(tx, requestId);
      await this.transitions.apply(tx, {
        requestId,
        action: 'ADMIN_CANCEL',
        actor: { id: admin.id, role: 'ADMIN' },
        reason,
        set: [Prisma.sql`review_deadline_at = NULL`],
      });
      await this.assignments.endActive(tx, requestId, 'CANCELLED', reason);
      const audience = [
        rooms.user(req.requester_id),
        rooms.admin,
        rooms.request(requestId),
        ...(current ? [rooms.user(current.technicianId)] : []),
      ];
      await this.outbox.enqueue(tx, 'admin.override', requestId, audience, {
        requestId,
        action: 'CANCEL',
        reason,
      });
      await this.audit.record(tx, {
        actorId: admin.id,
        actorRole: 'ADMIN',
        action: 'admin.override.cancel',
        entityType: 'service_request',
        entityId: requestId,
        requestId,
        metadata: { reason },
      });
      return (await this.repo.getView(tx, requestId))!;
    });
  }
}
