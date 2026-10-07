import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Env } from '@dispatch/config';
import { EvidenceIntentDto, EvidenceIntentResponse, rooms } from '@dispatch/contracts';
import { AppException } from '../../common/app-exception';
import { AuthUser } from '../../common/decorators';
import { APP_CONFIG } from '../../config/config.module';
import { sha256Hex } from '../../domain/hash';
import {
  MAX_EVIDENCE_BYTES,
  MAX_EVIDENCE_PER_CYCLE,
  detectImageType,
  extensionFor,
} from '../../domain/media';
import { AuditService } from '../../infra/audit.service';
import { IdempotencyService } from '../../infra/idempotency.service';
import { OutboxService } from '../../infra/outbox.service';
import { Db, PrismaService } from '../../infra/prisma.service';
import { lockRequest } from '../../infra/request-sql';
import { AccessService } from '../requests/access.service';
import { AssignmentsService } from './assignments.service';
import { STORAGE_PROVIDER, StorageProvider } from './storage/storage.provider';

interface MediaRow {
  id: string;
  work_cycle: number;
  content_type: string;
  size_bytes: number;
  checksum_sha256: string;
  object_key: string;
  status: 'PENDING' | 'FINALIZED';
}

export interface EvidenceItem {
  id: string;
  workCycle: number;
  contentType: string;
  sizeBytes: number;
  finalizedAt: string;
  url: string;
  expiresAt: string;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: AssignmentsService,
    private readonly access: AccessService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(APP_CONFIG) private readonly cfg: Env,
  ) {}

  /** Step 1: reserve a server-generated object key and hand out a short-lived presigned PUT. */
  async createIntent(
    user: AuthUser,
    requestId: string,
    dto: EvidenceIntentDto,
  ): Promise<EvidenceIntentResponse> {
    const reserved = await this.prisma.tx(async (tx) => {
      const req = await lockRequest(tx, requestId);
      if (!req || !(await this.assignments.isActiveAssignee(tx, requestId, user.id)))
        throw new AppException('NOT_FOUND');
      if (req.state !== 'IN_PROGRESS')
        throw new AppException('STATE_CONFLICT', 'Evidence can only be added while work is in progress');
      const count = await tx.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM evidence_media WHERE request_id = ${requestId}::uuid AND work_cycle = ${req.work_cycle}::int`;
      if (count[0]!.n >= MAX_EVIDENCE_PER_CYCLE)
        throw new AppException('STATE_CONFLICT', 'Evidence limit reached for this work cycle');

      const ext = extensionFor(dto.contentType);
      const key = `evidence/${requestId}/c${req.work_cycle}/${randomUUID()}.${ext}`; // never client-controlled
      const rows = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO evidence_media (request_id, work_cycle, uploader_id, object_key, content_type, size_bytes, checksum_sha256)
        VALUES (${requestId}::uuid, ${req.work_cycle}::int, ${user.id}::uuid, ${key}, ${dto.contentType}, ${dto.sizeBytes}::int, ${dto.checksumSha256})
        RETURNING id::text AS id`;
      return { mediaId: rows[0]!.id, key };
    });
    const put = await this.storage.presignPut({
      key: reserved.key,
      contentType: dto.contentType,
      sizeBytes: dto.sizeBytes,
      ttlSeconds: this.cfg.S3_PRESIGN_TTL_SECONDS,
    });
    return {
      mediaId: reserved.mediaId,
      uploadUrl: put.url,
      method: put.method,
      headers: put.headers,
      expiresAt: put.expiresAt.toISOString(),
    };
  }

  /**
   * Step 2: verify what was actually uploaded (size, SHA-256, magic bytes) and mark it FINALIZED.
   * Verification happens before the transaction so no row locks are held during the object read.
   */
  async finalize(user: AuthUser, requestId: string, mediaId: string, key: string) {
    const media = await this.loadOwnedMedia(this.prisma, user, requestId, mediaId);
    if (media.status === 'PENDING') await this.verifyUpload(media);

    return this.prisma.tx((tx) =>
      this.idempotency.run(
        tx,
        {
          userId: user.id,
          method: 'POST',
          route: '/requests/:id/evidence',
          resourceId: requestId,
          key,
          body: { mediaId },
        },
        async () => {
          const req = await lockRequest(tx, requestId);
          if (!req || !(await this.assignments.isActiveAssignee(tx, requestId, user.id)))
            throw new AppException('NOT_FOUND');
          const current = await this.loadOwnedMedia(tx, user, requestId, mediaId);
          if (current.status === 'PENDING') {
            if (req.state !== 'IN_PROGRESS')
              throw new AppException(
                'STATE_CONFLICT',
                'Evidence can only be finalized while work is in progress',
              );
            if (current.work_cycle !== req.work_cycle)
              throw new AppException('STATE_CONFLICT', 'This upload belongs to an earlier work cycle');
            await tx.$executeRaw`UPDATE evidence_media SET status = 'FINALIZED', finalized_at = now() WHERE id = ${mediaId}::uuid AND status = 'PENDING'`;
            await this.audit.record(tx, {
              actorId: user.id,
              actorRole: 'TECHNICIAN',
              action: 'evidence.finalize',
              entityType: 'evidence_media',
              entityId: mediaId,
              requestId,
              metadata: { workCycle: current.work_cycle, sizeBytes: current.size_bytes },
            });
            const owner = await tx.$queryRaw<
              { requester_id: string }[]
            >`SELECT requester_id::text AS requester_id FROM service_requests WHERE id = ${requestId}::uuid`;
            await this.outbox.enqueue(
              tx,
              'evidence.uploaded',
              requestId,
              [rooms.user(owner[0]!.requester_id), rooms.admin, rooms.request(requestId)],
              {
                requestId,
                mediaId,
                workCycle: current.work_cycle,
              },
            );
          }
          const n = await tx.$queryRaw<{ n: number }[]>`
            SELECT count(*)::int AS n FROM evidence_media WHERE request_id = ${requestId}::uuid AND work_cycle = ${req.work_cycle}::int AND status = 'FINALIZED'`;
          return {
            mediaId,
            status: 'FINALIZED' as const,
            workCycle: current.work_cycle,
            finalizedCount: n[0]!.n,
          };
        },
      ),
    );
  }

  private async loadOwnedMedia(
    db: Db,
    user: AuthUser,
    requestId: string,
    mediaId: string,
  ): Promise<MediaRow> {
    const rows = await db.$queryRaw<MediaRow[]>`
      SELECT id::text AS id, work_cycle, content_type, size_bytes, checksum_sha256, object_key, status
      FROM evidence_media
      WHERE id = ${mediaId}::uuid AND request_id = ${requestId}::uuid AND uploader_id = ${user.id}::uuid`;
    if (!rows[0]) throw new AppException('NOT_FOUND');
    return rows[0];
  }

  private async verifyUpload(m: MediaRow): Promise<void> {
    const bytes = await this.storage.getObject(m.object_key, MAX_EVIDENCE_BYTES);
    if (!bytes) throw new AppException('MEDIA_REJECTED', 'No uploaded file was found for this evidence item');
    if (bytes.length !== m.size_bytes)
      throw new AppException('MEDIA_REJECTED', 'Uploaded file size does not match the declared size');
    if (sha256Hex(bytes) !== m.checksum_sha256)
      throw new AppException('MEDIA_REJECTED', 'Uploaded file checksum does not match');
    const real = detectImageType(bytes);
    if (real === null || real !== m.content_type)
      throw new AppException('MEDIA_REJECTED', 'Uploaded file is not a valid image of the declared type');
  }

  /** Finalized evidence with short-lived signed GET URLs, for anyone allowed to view the request. */
  async list(user: Pick<AuthUser, 'id' | 'role'>, requestId: string): Promise<EvidenceItem[]> {
    await this.access.assertView(this.prisma, user, requestId);
    return this.listForRequest(this.prisma, requestId);
  }

  async listForRequest(db: Db, requestId: string): Promise<EvidenceItem[]> {
    const rows = await db.$queryRaw<(MediaRow & { finalized_at: Date })[]>`
      SELECT id::text AS id, work_cycle, content_type, size_bytes, checksum_sha256, object_key, status, finalized_at
      FROM evidence_media WHERE request_id = ${requestId}::uuid AND status = 'FINALIZED'
      ORDER BY work_cycle, finalized_at`;
    return Promise.all(
      rows.map(async (r) => {
        const signed = await this.storage.presignGet(r.object_key, this.cfg.S3_PRESIGN_TTL_SECONDS);
        return {
          id: r.id,
          workCycle: r.work_cycle,
          contentType: r.content_type,
          sizeBytes: r.size_bytes,
          finalizedAt: r.finalized_at.toISOString(),
          url: signed.url,
          expiresAt: signed.expiresAt.toISOString(),
        };
      }),
    );
  }
}
