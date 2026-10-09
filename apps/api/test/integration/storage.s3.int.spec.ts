import { createHash, randomBytes } from 'node:crypto';
import { loadEnv } from '@dispatch/config';
import { MinioStorageProvider } from '../../src/modules/media/storage/minio.storage';
import { TestCtx, createTestApp } from '../support/app';
import { Flow } from '../support/flow';
import { S3Server, startS3Server } from '../support/s3';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const png = () => Buffer.concat([PNG_MAGIC, randomBytes(64)]);
/** Changes one hex digit of the signature, keeping it well-formed so the server must verify (not just parse) it. */
const flipSignature = (url: string): string =>
  url.replace(/(X-Amz-Signature=)([0-9a-f])/, (_m, p, c: string) => p + (c === '0' ? '1' : '0'));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://u:p@localhost:5432/d',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'j'.repeat(48),
  OTP_HMAC_SECRET: 'o'.repeat(48),
  INSECURE_LOCAL_DEV: 'true',
};

/**
 * The S3 adapter against a REAL S3-compatible server (RustFS, the image docker-compose runs): real SigV4 signatures,
 * real expiry enforcement, a real private bucket. Nothing here is mocked.
 */
describe('S3 evidence adapter against a real S3-compatible server', () => {
  let s3: S3Server;
  const providerFor = (over: Record<string, string> = {}) =>
    new MinioStorageProvider(
      loadEnv({
        ...baseEnv,
        S3_ENDPOINT: s3.endpoint,
        S3_BUCKET: s3.bucket,
        S3_ACCESS_KEY: s3.accessKey,
        S3_SECRET_KEY: s3.secretKey,
        ...over,
      }),
    );

  beforeAll(async () => {
    s3 = await startS3Server();
  }, 180_000);
  afterAll(async () => {
    await s3.stop();
  });

  describe('adapter', () => {
    it('uploads through a presigned PUT and reads the exact bytes back (getObject, presigned GET)', async () => {
      const storage = providerFor();
      const bytes = png();
      const key = `evidence/adapter/${randomBytes(6).toString('hex')}.png`;

      const put = await storage.presignPut({
        key,
        contentType: 'image/png',
        sizeBytes: bytes.length,
        ttlSeconds: 60,
      });
      expect(put.method).toBe('PUT');
      const up = await fetch(put.url, { method: 'PUT', body: bytes, headers: put.headers });
      expect(up.status).toBe(200);

      const stored = await storage.getObject(key, 1024 * 1024);
      expect(stored && createHash('sha256').update(stored).digest('hex')).toBe(
        createHash('sha256').update(bytes).digest('hex'),
      );

      const get = await storage.presignGet(key, 60);
      const res = await fetch(get.url);
      expect(res.status).toBe(200);
      expect(Buffer.from(await res.arrayBuffer()).equals(bytes)).toBe(true);
      expect(storage.isMock).toBe(false);
    });

    it('returns null for a missing object and refuses oversize ones', async () => {
      const storage = providerFor();
      expect(await storage.getObject('evidence/adapter/none.png', 1024)).toBeNull();
      const key = `evidence/adapter/${randomBytes(6).toString('hex')}.png`;
      const bytes = png();
      const put = await storage.presignPut({
        key,
        contentType: 'image/png',
        sizeBytes: bytes.length,
        ttlSeconds: 60,
      });
      await fetch(put.url, { method: 'PUT', body: bytes, headers: put.headers });
      await expect(storage.getObject(key, 10)).rejects.toThrow(/too large/);
    });

    it('DENIES an expired signed URL', async () => {
      const storage = providerFor();
      const key = `evidence/adapter/${randomBytes(6).toString('hex')}.png`;
      const bytes = png();
      const put = await storage.presignPut({
        key,
        contentType: 'image/png',
        sizeBytes: bytes.length,
        ttlSeconds: 60,
      });
      await fetch(put.url, { method: 'PUT', body: bytes, headers: put.headers });

      const get = await storage.presignGet(key, 2);
      expect((await fetch(get.url)).status).toBe(200); // valid while fresh
      await sleep(3500);
      const expired = await fetch(get.url);
      expect(expired.status).toBe(403);
      expect(await expired.text()).not.toContain(bytes.toString('latin1'));

      const putExpired = await storage.presignPut({
        key: `${key}.late`,
        contentType: 'image/png',
        sizeBytes: bytes.length,
        ttlSeconds: 2,
      });
      await sleep(3500);
      const lateUpload = await fetch(putExpired.url, {
        method: 'PUT',
        body: bytes,
        headers: putExpired.headers,
      });
      expect(lateUpload.status).toBe(403);
      expect(await storage.getObject(`${key}.late`, 1024 * 1024)).toBeNull(); // nothing was written
    }, 30_000);

    it('DENIES a URL that was not signed for this object, was tampered with, or was signed by the wrong credentials', async () => {
      const storage = providerFor();
      const bytes = png();
      const keyA = `evidence/adapter/a-${randomBytes(4).toString('hex')}.png`;
      const keyB = `evidence/adapter/b-${randomBytes(4).toString('hex')}.png`;
      for (const key of [keyA, keyB]) {
        const put = await storage.presignPut({
          key,
          contentType: 'image/png',
          sizeBytes: bytes.length,
          ttlSeconds: 60,
        });
        await fetch(put.url, { method: 'PUT', body: bytes, headers: put.headers });
      }
      const urlA = (await storage.presignGet(keyA, 60)).url;

      // another user's object: A's signature replayed against B's path
      expect((await fetch(urlA.replace(keyA, keyB))).status).toBe(403);
      // tampered signature
      expect((await fetch(flipSignature(urlA))).status).toBe(403);
      // signature stripped entirely
      expect((await fetch(urlA.split('?')[0]!)).status).toBe(403);
      // signed with credentials the server does not know
      const stranger = providerFor({ S3_SECRET_KEY: 'not-the-real-secret-key' });
      expect((await fetch((await stranger.presignGet(keyA, 60)).url)).status).toBe(403);
      // a GET URL cannot be reused to write
      expect((await fetch(urlA, { method: 'PUT', body: bytes })).status).toBe(403);
    });

    it('keeps the bucket private: anonymous reads and listings are refused', async () => {
      const storage = providerFor();
      const key = `evidence/adapter/${randomBytes(6).toString('hex')}.png`;
      const bytes = png();
      const put = await storage.presignPut({
        key,
        contentType: 'image/png',
        sizeBytes: bytes.length,
        ttlSeconds: 60,
      });
      await fetch(put.url, { method: 'PUT', body: bytes, headers: put.headers });
      expect((await fetch(`${s3.endpoint}/${s3.bucket}/${key}`)).status).toBe(403);
      expect((await fetch(`${s3.endpoint}/${s3.bucket}?list-type=2`)).status).toBe(403);
    });
  });

  describe('through the API (STORAGE_PROVIDER=minio): only participants get URLs, and URLs expire', () => {
    let ctx: TestCtx;
    let flow: Flow;
    beforeAll(async () => {
      ctx = await createTestApp({
        env: {
          STORAGE_PROVIDER: 'minio',
          S3_ENDPOINT: s3.endpoint,
          S3_BUCKET: s3.bucket,
          S3_ACCESS_KEY: s3.accessKey,
          S3_SECRET_KEY: s3.secretKey,
          S3_PRESIGN_TTL_SECONDS: '3',
        },
      });
      flow = new Flow(ctx);
    }, 120_000);
    afterAll(async () => {
      await flow.cleanup();
      await ctx.close();
    });

    it('runs the proof gate with real presigned uploads and enforces signed-URL access for readers', async () => {
      const job = await flow.inProgress(1, 'requester1');
      expect(flow.storage.isMock).toBe(false);

      // one real image: stopping is still blocked by the proof gate
      expect((await flow.uploadEvidence(job.id, job.tech)).status).toBe(200);
      const early = await flow.stop(job.id, job.tech);
      expect(early.status).toBe(409);
      expect(early.body.code).toBe('EVIDENCE_REQUIRED');

      // the second real image opens the gate
      expect((await flow.uploadEvidence(job.id, job.tech)).status).toBe(200);
      const stopped = await flow.stop(job.id, job.tech);
      expect(stopped.status).toBe(200);

      // the requester receives short-lived signed URLs that work now and are denied after expiry
      const listed = await flow.get('requester1', `/requests/${job.id}/evidence`);
      expect(listed.status).toBe(200);
      expect(listed.body).toHaveLength(2);
      const url = listed.body[0].url as string;
      expect(url).toContain('X-Amz-Signature=');
      for (const { url: _signed, ...fields } of listed.body as { url: string }[]) {
        expect(JSON.stringify(fields)).not.toMatch(/object_?key|checksum|secret/i); // internal columns stay internal
      }
      expect((await fetch(url)).status).toBe(200);

      // a wrong user never gets a URL at all (same 404 as an unknown job)
      for (const who of ['requester2', 'tech4'] as const) {
        const denied = await flow.get(who, `/requests/${job.id}/evidence`);
        expect(denied.status).toBe(404);
        expect(JSON.stringify(denied.body)).not.toContain('X-Amz-Signature');
      }
      expect((await ctx.http().get(`/api/v1/requests/${job.id}/evidence`)).status).toBe(401);

      await sleep(4000); // TTL is 3 s
      expect((await fetch(url)).status).toBe(403);
      // a fresh request by the same participant yields a new, working URL
      const again = await flow.get('requester1', `/requests/${job.id}/evidence`);
      expect((await fetch(again.body[0].url as string)).status).toBe(200);
    }, 60_000);
  });
});
