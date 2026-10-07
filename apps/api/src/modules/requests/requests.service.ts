import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateRequestDto, RequestView, rooms } from '@dispatch/contracts';
import { AppException } from '../../common/app-exception';
import { AuthUser } from '../../common/decorators';
import { AuditService } from '../../infra/audit.service';
import { OutboxService } from '../../infra/outbox.service';
import { PrismaService, Tx } from '../../infra/prisma.service';
import { AccessService } from './access.service';
import { RequestsRepository } from './requests.repository';

const MAX_WINDOW_MS = 24 * 3600 * 1000;
const PAGE_SIZE = 50;

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: RequestsRepository,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  private validateWindow(startIso: string, endIso: string): void {
    const start = Date.parse(startIso);
    const end = Date.parse(endIso);
    if (!(end > start)) throw new AppException('VALIDATION_FAILED', 'windowEnd must be after windowStart');
    if (end <= Date.now())
      throw new AppException('VALIDATION_FAILED', 'The time window must end in the future');
    if (end - start > MAX_WINDOW_MS)
      throw new AppException('VALIDATION_FAILED', 'The time window cannot exceed 24 hours');
  }

  /** Inserts the request plus its CREATED job_event, audit row and outbox event in the caller's transaction. */
  private async createIn(
    tx: Tx,
    user: AuthUser,
    dto: Pick<CreateRequestDto, 'assetId' | 'category' | 'location' | 'windowStart' | 'windowEnd' | 'notes'>,
    reorderOf: string | null,
  ): Promise<string> {
    const id = await this.repo.insert(tx, user.id, dto, reorderOf);
    await tx.$executeRaw`
      INSERT INTO job_events (request_id, state_from, state_to, action, actor_id, actor_role, metadata)
      VALUES (${id}::uuid, NULL, 'CREATED', 'CREATE', ${user.id}::uuid, 'REQUESTER', ${JSON.stringify(reorderOf ? { reorderOf } : {})}::jsonb)`;
    await this.audit.record(tx, {
      actorId: user.id,
      actorRole: 'REQUESTER',
      action: reorderOf ? 'request.reorder' : 'request.create',
      entityType: 'service_request',
      entityId: id,
      requestId: id,
      metadata: { category: dto.category, ...(reorderOf ? { reorderOf } : {}) },
    });
    await this.outbox.enqueue(tx, 'request.created', id, [rooms.admin, rooms.user(user.id)], {
      requestId: id,
      category: dto.category,
      state: 'CREATED',
    });
    return id;
  }

  async create(user: AuthUser, dto: CreateRequestDto): Promise<RequestView> {
    this.validateWindow(dto.windowStart, dto.windowEnd);
    return this.prisma.tx(async (tx) => {
      const id = await this.createIn(tx, user, dto, null);
      return (await this.repo.getView(tx, id))!;
    });
  }

  async get(user: AuthUser, id: string): Promise<RequestView> {
    await this.access.assertView(this.prisma, user, id);
    return (await this.repo.getView(this.prisma, id))!;
  }

  private participantFilter(user: AuthUser): Prisma.Sql {
    return user.role === 'TECHNICIAN'
      ? Prisma.sql`EXISTS (SELECT 1 FROM assignments a WHERE a.request_id = r.id AND a.technician_id = ${user.id}::uuid)`
      : Prisma.sql`r.requester_id = ${user.id}::uuid`;
  }

  /** Completed / cancelled requests for the caller (requester: own; technician: ones they worked). */
  history(user: AuthUser, page: number): Promise<RequestView[]> {
    const where = Prisma.sql`${this.participantFilter(user)} AND r.state IN ('COMPLETED', 'CANCELLED')`;
    return this.repo.listViews(this.prisma, where, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  }

  /** In-flight requests for the caller's home screen. */
  active(user: AuthUser): Promise<RequestView[]> {
    const where =
      user.role === 'TECHNICIAN'
        ? Prisma.sql`EXISTS (SELECT 1 FROM assignments a WHERE a.request_id = r.id AND a.technician_id = ${user.id}::uuid AND a.status = 'ACTIVE')
                     AND r.state NOT IN ('COMPLETED', 'CANCELLED')`
        : Prisma.sql`r.requester_id = ${user.id}::uuid AND r.state NOT IN ('COMPLETED', 'CANCELLED')`;
    return this.repo.listViews(this.prisma, where, PAGE_SIZE, 0);
  }

  /** New request from a finished one (same asset/category/location/notes; window starts in one hour). */
  async reorder(user: AuthUser, id: string): Promise<RequestView> {
    return this.prisma.tx(async (tx) => {
      const prev = await this.repo.getRaw(tx, id);
      if (!prev || prev.requester_id !== user.id) throw new AppException('NOT_FOUND');
      if (prev.state !== 'COMPLETED' && prev.state !== 'CANCELLED') {
        throw new AppException('STATE_CONFLICT', 'Only finished requests can be reordered');
      }
      const duration = Math.min(prev.window_end.getTime() - prev.window_start.getTime(), MAX_WINDOW_MS);
      const start = new Date(Date.now() + 3600 * 1000);
      const newId = await this.createIn(
        tx,
        user,
        {
          assetId: prev.asset_id,
          category: prev.category,
          location: { lat: prev.lat, lon: prev.lon },
          windowStart: start.toISOString(),
          windowEnd: new Date(start.getTime() + duration).toISOString(),
          notes: prev.notes ?? undefined,
        },
        prev.id,
      );
      return (await this.repo.getView(tx, newId))!;
    });
  }

  /** Reconnect resync: current state plus every event the caller missed after `since`. */
  async snapshot(user: AuthUser, id: string, since: number) {
    await this.access.assertView(this.prisma, user, id);
    const recipient = user.role === 'ADMIN' ? rooms.admin : rooms.user(user.id);
    const [request, events] = await Promise.all([
      this.repo.getView(this.prisma, id),
      this.repo.eventsSince(this.prisma, id, recipient, since),
    ]);
    const cursor = events.length ? events[events.length - 1]!.seq : since;
    return { request: request!, events, cursor };
  }
}
