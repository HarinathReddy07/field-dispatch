import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Env } from '@dispatch/config';
import { NearbyQuery, NearbyTechnician, RequestView, rooms } from '@dispatch/contracts';
import { AppException } from '../../common/app-exception';
import { AuthUser } from '../../common/decorators';
import { APP_CONFIG } from '../../config/config.module';
import { calculateQuote, metersToKm } from '../../domain/pricing';
import { Candidate, rankCandidates, toNearby } from '../../domain/ranking';
import { AuditService } from '../audit/audit.service';
import { IdempotencyService } from '../../infra/idempotency.service';
import { OutboxService } from '../../infra/outbox.service';
import { PrismaService, Tx, pgCode } from '../../infra/prisma.service';
import { lockRequest } from '../../infra/request-sql';
import { TransitionService } from '../../infra/transition.service';
import { RequestsRepository } from '../requests/requests.repository';

interface CandidateRow {
  technician_id: string;
  name: string;
  rating: number;
  distance_m: number;
  availability_status: 'AVAILABLE';
}

interface TechnicianLockRow {
  availability_status: string;
  service_categories: string[];
  distance_m: number;
  in_range: boolean;
  fresh: boolean;
}

/**
 * Proximity search and atomic technician reservation.
 *
 * Confirmation order is fixed to avoid deadlocks: request row -> technician row. The technician row
 * lock serialises competing requests for the same technician; the partial unique index and the
 * exclusion constraint on `assignments` are the database-level backstop.
 */
@Injectable()
export class DispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: RequestsRepository,
    private readonly transitions: TransitionService,
    private readonly idempotency: IdempotencyService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly cfg: Env,
  ) {}

  async nearby(user: AuthUser, requestId: string, query: NearbyQuery): Promise<NearbyTechnician[]> {
    const radiusKm = query.radiusKm ?? this.cfg.SEARCH_RADIUS_KM;
    const limit = query.limit ?? 10;
    return this.prisma.tx(async (tx) => {
      const req = await lockRequest(tx, requestId);
      if (!req || req.requester_id !== user.id) throw new AppException('NOT_FOUND');
      if (req.state !== 'REQUESTED' && req.state !== 'MATCHED') {
        throw new AppException(
          'STATE_CONFLICT',
          'Technicians can only be searched before a booking is confirmed',
        );
      }
      if (req.state === 'REQUESTED') {
        await this.transitions.apply(tx, {
          requestId,
          action: 'SEARCH',
          actor: { id: user.id, role: 'REQUESTER' },
          metadata: { radiusKm },
        });
      }
      const rows = await this.findCandidates(tx, requestId, req.category, radiusKm, limit);
      const ranked = rankCandidates(
        rows.map((r): Candidate => ({
          technicianId: r.technician_id,
          name: r.name,
          rating: r.rating,
          distanceKm: metersToKm(r.distance_m),
          availability: r.availability_status,
        })),
        limit,
      );
      return ranked.map((c) => toNearby(c, req.category));
    });
  }

  /** PostGIS candidate search: ST_DWithin (GiST) + availability + category + freshness + no overlapping job. */
  private findCandidates(tx: Tx, requestId: string, category: string, radiusKm: number, limit: number) {
    return tx.$queryRaw<CandidateRow[]>`
      SELECT t.user_id::text AS technician_id, u.name, u.rating::float8 AS rating,
             ST_Distance(t.location, r.location) AS distance_m, t.availability_status
      FROM service_requests r
      JOIN technicians t
        ON t.availability_status = 'AVAILABLE'
       AND ${category} = ANY (t.service_categories)
       AND t.location IS NOT NULL
       AND t.last_seen_at >= now() - make_interval(secs => ${this.cfg.LOCATION_FRESHNESS_SECONDS}::float8)
       AND ST_DWithin(t.location, r.location, ${radiusKm * 1000}::float8)
      JOIN users u ON u.id = t.user_id AND u.status = 'ACTIVE'
      WHERE r.id = ${requestId}::uuid
        AND NOT EXISTS (
          SELECT 1 FROM assignments a
          WHERE a.technician_id = t.user_id AND a.status = 'ACTIVE'
            AND a.time_window && tstzrange(r.window_start, r.window_end, '[)'))
      ORDER BY distance_m ASC, u.rating DESC, t.user_id ASC
      LIMIT ${limit}::int`;
  }

  async confirm(user: AuthUser, requestId: string, technicianId: string, key: string): Promise<RequestView> {
    try {
      return await this.prisma.tx((tx) =>
        this.idempotency.run(
          tx,
          {
            userId: user.id,
            method: 'POST',
            route: '/requests/:id/confirm',
            resourceId: requestId,
            key,
            body: { technicianId },
          },
          () => this.confirmIn(tx, user, requestId, technicianId),
        ),
      );
    } catch (e) {
      const code = pgCode(e);
      if (code === '23505' || code === '23P01') throw new AppException('TECHNICIAN_UNAVAILABLE');
      if (code === '40001' || code === '40P01') throw new AppException('STATE_CONFLICT');
      throw e;
    }
  }

  private async confirmIn(
    tx: Tx,
    user: AuthUser,
    requestId: string,
    technicianId: string,
  ): Promise<RequestView> {
    const req = await lockRequest(tx, requestId); // 1) request row
    if (!req || req.requester_id !== user.id) throw new AppException('NOT_FOUND');
    if (req.state !== 'MATCHED') {
      throw new AppException(
        'STATE_CONFLICT',
        req.state === 'REQUESTED'
          ? 'Search for nearby technicians before confirming'
          : 'This request has already been confirmed or closed',
      );
    }

    // 2) technician row. Eligibility is re-checked under the lock; the search result may be stale.
    const techRows = await tx.$queryRaw<TechnicianLockRow[]>`
      SELECT t.availability_status, t.service_categories,
             ST_Distance(t.location, r.location) AS distance_m,
             ST_DWithin(t.location, r.location, ${this.cfg.SEARCH_RADIUS_KM * 1000}::float8) AS in_range,
             (t.last_seen_at >= now() - make_interval(secs => ${this.cfg.LOCATION_FRESHNESS_SECONDS}::float8)) AS fresh
      FROM technicians t
      JOIN users u ON u.id = t.user_id AND u.status = 'ACTIVE'
      JOIN service_requests r ON r.id = ${requestId}::uuid
      WHERE t.user_id = ${technicianId}::uuid AND t.location IS NOT NULL
      FOR UPDATE OF t`;
    const tech = techRows[0];
    if (
      !tech ||
      tech.availability_status !== 'AVAILABLE' ||
      !tech.service_categories.includes(req.category) ||
      !tech.in_range ||
      !tech.fresh
    ) {
      throw new AppException('TECHNICIAN_UNAVAILABLE');
    }
    const overlap = await tx.$queryRaw<{ one: number }[]>`
      SELECT 1 AS one FROM assignments
      WHERE technician_id = ${technicianId}::uuid AND status = 'ACTIVE'
        AND time_window && tstzrange(${req.window_start}::timestamptz, ${req.window_end}::timestamptz, '[)')
      LIMIT 1`;
    if (overlap.length > 0) throw new AppException('TECHNICIAN_UNAVAILABLE');

    const quoteMinor = calculateQuote(req.category, metersToKm(tech.distance_m)); // server-computed, never client-supplied
    const inserted = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO assignments (request_id, technician_id, status, time_window, quote_minor)
      VALUES (${requestId}::uuid, ${technicianId}::uuid, 'ACTIVE',
              tstzrange(${req.window_start}::timestamptz, ${req.window_end}::timestamptz, '[)'), ${quoteMinor}::int)
      RETURNING id::text AS id`;
    const assignmentId = inserted[0]!.id;
    await tx.$executeRaw`UPDATE technicians SET availability_status = 'BUSY' WHERE user_id = ${technicianId}::uuid`;

    await this.transitions.apply(tx, {
      requestId,
      action: 'CONFIRM',
      actor: { id: user.id, role: 'REQUESTER' },
      set: [Prisma.sql`quote_minor = ${quoteMinor}`],
      metadata: { technicianId, assignmentId, quoteMinor },
    });
    await this.audit.record(tx, {
      actorId: user.id,
      actorRole: 'REQUESTER',
      action: 'assignment.create',
      entityType: 'assignment',
      entityId: assignmentId,
      requestId,
      metadata: { technicianId, quoteMinor },
    });
    await this.outbox.enqueue(
      tx,
      'assignment.created',
      requestId,
      [rooms.user(user.id), rooms.user(technicianId), rooms.admin, rooms.request(requestId)],
      { requestId, assignmentId, technicianId, quoteMinor },
    );
    return (await this.repo.getView(tx, requestId))!;
  }
}
