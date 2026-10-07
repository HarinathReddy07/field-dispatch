import { createHash, randomBytes } from 'node:crypto';
import { TestCtx, createTestApp } from '../support/app';
import { Flow } from '../support/flow';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const png = () => Buffer.concat([PNG, randomBytes(48)]);
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

describe('evidence media security', () => {
  let ctx: TestCtx;
  let flow: Flow;
  let id: string;
  beforeAll(async () => {
    ctx = await createTestApp({ env: { S3_PRESIGN_TTL_SECONDS: '60' } });
    flow = new Flow(ctx);
    id = (await flow.inProgress(1, 'requester1')).id;
  });
  afterAll(async () => {
    await flow.cleanup();
    await ctx.close();
  });

  const intent = (bytes: Buffer, over: Record<string, unknown> = {}, who: 'tech1' | 'tech4' = 'tech1') =>
    flow.post(
      who,
      `/requests/${id}/evidence/intent`,
      { contentType: 'image/png', sizeBytes: bytes.length, checksumSha256: sha(bytes), ...over },
      null,
    );
  const finalize = (mediaId: string, who: 'tech1' | 'tech4' = 'tech1') =>
    flow.post(who, `/requests/${id}/evidence`, { mediaId });

  it('uses server-generated private object keys and short-lived presigned URLs', async () => {
    const bytes = png();
    const res = await intent(bytes);
    expect(res.status).toBe(200);
    expect(res.body.method).toBe('PUT');
    const [row] = await ctx.sql<{ object_key: string; status: string }>(
      `SELECT object_key, status FROM evidence_media WHERE id = $1`,
      [res.body.mediaId],
    );
    expect(row!.object_key).toMatch(new RegExp(`^evidence/${id}/c1/[0-9a-f-]{36}\\.png$`));
    expect(row!.status).toBe('PENDING');
    expect(Date.parse(res.body.expiresAt) - Date.now()).toBeLessThanOrEqual(60_000);
    // a client can't choose the key or smuggle fields
    expect((await intent(bytes, { objectKey: '../../etc/passwd' })).status).toBe(400);
  });

  it('rejects bad declarations before storing anything', async () => {
    const bytes = png();
    expect((await intent(bytes, { contentType: 'image/gif' })).status).toBe(400);
    expect((await intent(bytes, { contentType: 'text/html' })).status).toBe(400);
    expect((await intent(bytes, { sizeBytes: 6 * 1024 * 1024 })).status).toBe(400);
    expect((await intent(bytes, { sizeBytes: 0 })).status).toBe(400);
    expect((await intent(bytes, { checksumSha256: 'xyz' })).status).toBe(400);
  });

  it('finalize verifies the real bytes: magic number, checksum, size and presence', async () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    const disguised = await intent(html);
    expect(ctx).toBeTruthy();
    expect(flow.storage.put(disguised.body.uploadUrl, html)).toBe(200);
    const r1 = await finalize(disguised.body.mediaId);
    expect(r1.status).toBe(422);
    expect(r1.body.code).toBe('MEDIA_REJECTED');

    const good = png();
    const wrongSum = await intent(good, { checksumSha256: sha(png()) });
    flow.storage.put(wrongSum.body.uploadUrl, good);
    expect((await finalize(wrongSum.body.mediaId)).body.code).toBe('MEDIA_REJECTED');

    const wrongSize = await intent(good, { sizeBytes: good.length + 5 });
    flow.storage.put(wrongSize.body.uploadUrl, good);
    expect((await finalize(wrongSize.body.mediaId)).body.code).toBe('MEDIA_REJECTED');

    const missing = await intent(good);
    expect((await finalize(missing.body.mediaId)).body.code).toBe('MEDIA_REJECTED'); // nothing uploaded

    const asJpeg = await intent(good, { contentType: 'image/jpeg' }); // png bytes declared as jpeg
    flow.storage.put(asJpeg.body.uploadUrl, good);
    expect((await finalize(asJpeg.body.mediaId)).body.code).toBe('MEDIA_REJECTED');

    const finalized = await ctx.sql(
      `SELECT 1 FROM evidence_media WHERE request_id = $1 AND status = 'FINALIZED'`,
      [id],
    );
    expect(finalized).toHaveLength(0);
  });

  it('a valid upload finalizes once; retries replay; other technicians cannot finalize it', async () => {
    const bytes = png();
    const i = await intent(bytes);
    flow.storage.put(i.body.uploadUrl, bytes);
    expect((await finalize(i.body.mediaId, 'tech4')).status).toBe(404);
    const key = 'finalize-media-0001';
    const a = await flow.post('tech1', `/requests/${id}/evidence`, { mediaId: i.body.mediaId }, key);
    const b = await flow.post('tech1', `/requests/${id}/evidence`, { mediaId: i.body.mediaId }, key);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(b.body).toEqual(a.body);
    expect(
      await ctx.sql(`SELECT 1 FROM audit_logs WHERE entity_id = $1 AND action = 'evidence.finalize'`, [
        i.body.mediaId,
      ]),
    ).toHaveLength(1);
    expect(
      await ctx.sql(`SELECT 1 FROM outbox_events WHERE request_id = $1 AND type = 'evidence.uploaded'`, [id]),
    ).toHaveLength(1);
    expect((await finalize(i.body.mediaId)).status).toBe(200); // new key, already finalized: no duplicate side effects
    expect(
      await ctx.sql(`SELECT 1 FROM outbox_events WHERE request_id = $1 AND type = 'evidence.uploaded'`, [id]),
    ).toHaveLength(1);
  });

  it('only participants can read evidence, via short-lived signed URLs that expire', async () => {
    const asRequester = await flow.get('requester1', `/requests/${id}/evidence`);
    expect(asRequester.status).toBe(200);
    expect(asRequester.body).toHaveLength(1);
    const item = asRequester.body[0];
    expect(item.url).not.toContain(process.env.JWT_ACCESS_SECRET ?? 'never');
    expect(flow.storage.fetch(item.url).status).toBe(200);
    expect(flow.storage.fetch(item.url, Date.now() + 61_000).status).toBe(410); // expired
    expect(flow.storage.fetch(item.url.replace(/sig=[0-9a-f]{4}/, 'sig=dead')).status).toBe(403); // tampered

    expect((await flow.get('requester2', `/requests/${id}/evidence`)).status).toBe(404);
    expect((await flow.get('tech4', `/requests/${id}/evidence`)).status).toBe(404);
    expect((await flow.get('admin', `/requests/${id}/evidence`)).status).toBe(200);
    expect((await ctx.http().get(`/api/v1/requests/${id}/evidence`)).status).toBe(401);
    const logLike = JSON.stringify(item);
    expect(logLike).not.toMatch(/object_key|checksum/);
  });

  it('only the active technician can request an upload; requesters cannot', async () => {
    expect((await intent(png(), {}, 'tech4')).status).toBe(404);
    expect(
      (
        await flow.post(
          'requester1',
          `/requests/${id}/evidence/intent`,
          { contentType: 'image/png', sizeBytes: 10, checksumSha256: 'a'.repeat(64) },
          null,
        )
      ).status,
    ).toBe(403);
  });

  it('caps evidence items per work cycle', async () => {
    const results: number[] = [];
    for (let n = 0; n < 12; n++) results.push((await intent(png())).status);
    expect(results.filter((s) => s === 409).length).toBeGreaterThanOrEqual(1);
    const total = await ctx.sql<{ n: number }>(
      `SELECT count(*)::int AS n FROM evidence_media WHERE request_id = $1 AND work_cycle = 1`,
      [id],
    );
    expect(total[0]!.n).toBe(10);
  });
});
