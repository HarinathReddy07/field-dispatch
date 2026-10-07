import { randomInt, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Pool } from 'pg';
import request from 'supertest';
import { Env, loadEnv } from '@dispatch/config';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';
import { TestDb, createTestDatabase } from './db';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { seed, DEV_PASSWORD, ids } = require('../../../../infra/seed/seed.js') as {
  seed: (url: string) => Promise<unknown>;
  DEV_PASSWORD: string;
  ids: { REQ_COMPLETED: string; REQ_FRESH: string; REQ_BUSY: string; id: (n: number) => string };
};

export { DEV_PASSWORD, ids };

/** Seeded demo accounts (see infra/seed/seed.js). */
export const ACCOUNTS = {
  admin: 'admin@dispatch.test',
  requester1: 'requester1@dispatch.test',
  requester2: 'requester2@dispatch.test',
  requester3: 'requester3@dispatch.test',
  tech1: 'tech1@dispatch.test', // Anil, MG Road, both categories, 4.8
  tech2: 'tech2@dispatch.test', // Bhavna, Indiranagar, electrical
  tech3: 'tech3@dispatch.test', // Chetan, Koramangala, mechanical
  tech4: 'tech4@dispatch.test', // Divya, Jayanagar, both
  tech5: 'tech5@dispatch.test', // Esha, STALE
  tech6: 'tech6@dispatch.test', // Farhan, OFFLINE
  tech7: 'tech7@dispatch.test', // Gita, BUSY
  tech8: 'tech8@dispatch.test', // Harish, electrical
} as const;
export const TECH_ID = (n: number): string => ids.id(20 + n);
export const REQUESTER_ID = (n: number): string => ids.id(10 + n);

export interface TestCtx {
  app: NestExpressApplication;
  db: TestDb;
  env: Env;
  pool: Pool;
  http: () => ReturnType<typeof request>;
  login: (email: string, password?: string) => Promise<string>;
  sql: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;
  close: (o?: { keepDb?: boolean }) => Promise<void>;
}

export interface TestAppOptions {
  env?: Record<string, string>;
  seedData?: boolean;
  /** Reuse an existing (already migrated/seeded) database, e.g. to simulate an API restart. */
  db?: TestDb;
  logStream?: import('node:stream').Writable;
  logLevel?: string;
}

export async function createTestApp(opts: TestAppOptions = {}): Promise<TestCtx> {
  const db = opts.db ?? (await createTestDatabase());
  if (!opts.db && opts.seedData !== false) await seed(db.url);

  const redisBase = process.env.TEST_REDIS_URL;
  if (!redisBase) throw new Error('TEST_REDIS_URL is not set (global setup did not run)');
  const redisUrl = `${redisBase.replace(/\/\d*$/, '')}/${randomInt(1, 15)}`;

  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: db.url,
    REDIS_URL: redisUrl,
    JWT_ACCESS_SECRET: 'j'.repeat(48),
    OTP_HMAC_SECRET: 'o'.repeat(48),
    S3_ENDPOINT: 'http://localhost:9000',
    S3_BUCKET: 'test-bucket',
    S3_ACCESS_KEY: 'test-key',
    S3_SECRET_KEY: 'test-secret',
    STORAGE_PROVIDER: 'memory',
    BACKGROUND_JOBS: 'false',
    THROTTLE_DEFAULT_PER_MIN: '1000000',
    THROTTLE_LOGIN_PER_MIN: '100000',
    THROTTLE_ARRIVE_PER_MIN: '100000',
    LOCATION_FRESHNESS_SECONDS: '3600',
    ...opts.env,
  });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(env, { stream: opts.logStream, level: opts.logLevel })],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
  await configureApp(app, env);
  await app.init();
  await app.listen(0); // listening server => supertest reuses it (no per-request server) and sockets work

  const pool = new Pool({ connectionString: db.url, max: 5 });
  // Fresh Redis keyspace for this suite (throttle counters, presence, location cache).
  const { default: Redis } = await import('ioredis');
  if (!opts.db) {
    const r = new Redis(redisUrl);
    await r.flushdb();
    r.disconnect();
  }

  const http = () => request(app.getHttpServer());
  const login = async (email: string, password = DEV_PASSWORD): Promise<string> => {
    const res = await http().post('/api/v1/auth/login').send({ email, password });
    if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
    return res.body.accessToken as string;
  };
  return {
    app,
    db,
    env,
    pool,
    http,
    login,
    sql: async <T>(text: string, params: unknown[] = []) => (await pool.query(text, params)).rows as T[],
    close: async (o) => {
      await app.close();
      await pool.end();
      if (!o?.keepDb) await db.drop();
    },
  };
}

export const idemKey = (): string => randomUUID();

/** Request body for a new inspection near MG Road starting in one hour. */
export function newRequestBody(over: Record<string, unknown> = {}) {
  return {
    assetId: 'PANEL-TEST-001',
    category: 'ELECTRICAL_INSPECTION',
    location: { lat: 12.9748, lon: 77.6033 },
    windowStart: new Date(Date.now() + 3600_000).toISOString(),
    windowEnd: new Date(Date.now() + 3 * 3600_000).toISOString(),
    notes: 'integration test',
    ...over,
  };
}
