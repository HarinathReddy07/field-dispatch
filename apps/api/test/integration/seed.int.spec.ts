import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CATEGORY_RATES_MINOR, CategorySchema } from '@dispatch/contracts';

const CATEGORIES = CategorySchema.options;
import { TestCtx, createTestApp, ids } from '../support/app';

const { seed } = require('../../../../infra/seed/seed.js') as { seed: (url: string) => Promise<unknown> };

/** Appendix A: the seed data contract, verified against a database seeded exactly the way `make seed` does it. */
describe('seed data contract (Appendix A)', () => {
  let ctx: TestCtx;
  beforeAll(async () => {
    ctx = await createTestApp(); // createTestApp runs infra/seed/seed.js against a freshly migrated database
  });
  afterAll(() => ctx.close());

  const count = async (sql: string, params: unknown[] = []) =>
    (await ctx.sql<{ n: number }>(`SELECT count(*)::int AS n FROM (${sql}) q`, params))[0]!.n;

  it('has at least 2 requesters, 3 technicians and 1 admin', async () => {
    const rows = await ctx.sql<{ role: string; n: number }>(
      `SELECT role, count(*)::int AS n FROM users GROUP BY role`,
    );
    const by = Object.fromEntries(rows.map((r) => [r.role, r.n]));
    expect(by.REQUESTER).toBeGreaterThanOrEqual(2);
    expect(by.TECHNICIAN).toBeGreaterThanOrEqual(3);
    expect(by.ADMIN).toBeGreaterThanOrEqual(1);
  });

  it('has at least 3 active technicians with distinct coordinates and distinct ratings', async () => {
    const active = await ctx.sql<{ wkt: string; rating: number }>(
      `SELECT ST_AsText(t.location::geometry) AS wkt, u.rating::float8 AS rating
       FROM technicians t JOIN users u ON u.id = t.user_id
       WHERE t.availability_status = 'AVAILABLE' AND t.location IS NOT NULL AND t.last_seen_at IS NOT NULL`,
    );
    expect(active.length).toBeGreaterThanOrEqual(3);
    expect(new Set(active.map((a) => a.wkt)).size).toBe(active.length);
    expect(new Set(active.map((a) => a.rating)).size).toBeGreaterThanOrEqual(3);
  });

  it('has at least 2 inspection categories with fixed trial rates', async () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(2);
    for (const c of CATEGORIES) {
      expect(CATEGORY_RATES_MINOR[c].base).toBeGreaterThan(0);
      expect(CATEGORY_RATES_MINOR[c].perKm).toBeGreaterThan(0);
    }
    const covered = await ctx.sql<{ c: string }>(
      `SELECT DISTINCT unnest(service_categories) AS c FROM technicians`,
    );
    expect(new Set(covered.map((r) => r.c))).toEqual(new Set(CATEGORIES));
  });

  it('has one completed request (history/reorder) with its settlement, and one fresh request for the live demo', async () => {
    const [done] = await ctx.sql<{ state: string }>(`SELECT state FROM service_requests WHERE id = $1`, [
      ids.REQ_COMPLETED,
    ]);
    expect(done?.state).toBe('SETTLED');
    expect(await count(`SELECT 1 FROM settlements WHERE request_id = '${ids.REQ_COMPLETED}'`)).toBe(1);
    const [fresh] = await ctx.sql<{ state: string }>(`SELECT state FROM service_requests WHERE id = $1`, [
      ids.REQ_FRESH,
    ]);
    expect(fresh?.state).toBe('REQUESTED');
  });

  it('seeds no OTP at all: codes are generated at runtime, never stored in seed data', async () => {
    expect(await count(`SELECT 1 FROM otp_challenges`)).toBe(0);
  });

  it('contains no personal documents: seeded evidence (if any) and users are synthetic', async () => {
    const emails = await ctx.sql<{ email: string }>(`SELECT email FROM users`);
    expect(emails.every((e) => e.email.endsWith('@dispatch.test'))).toBe(true);
    const kinds = await ctx.sql<{ content_type: string }>(`SELECT DISTINCT content_type FROM evidence_media`);
    expect(kinds.every((k) => k.content_type.startsWith('image/'))).toBe(true);
  });

  it('is idempotent: running the seed again changes nothing', async () => {
    const tables = ['users', 'technicians', 'service_requests', 'assignments', 'settlements'];
    const before = await Promise.all(tables.map((t) => count(`SELECT 1 FROM ${t}`)));
    await seed(ctx.db.url);
    const after = await Promise.all(tables.map((t) => count(`SELECT 1 FROM ${t}`)));
    expect(after).toEqual(before);
  });
});

describe('no hard-coded OTP anywhere in the code path', () => {
  const root = resolve(__dirname, '../../../..');
  const scan = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      if (['node_modules', 'dist', '.next', 'coverage'].includes(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) scan(p, out);
      else if (/\.(ts|tsx|js)$/.test(name) && !/\.(spec|test)\./.test(name)) out.push(p);
    }
    return out;
  };

  it('production sources, the seed and the migration scripts never assign a literal 6-digit code to an OTP', () => {
    const files = [
      ...scan(join(root, 'apps/api/src')),
      ...scan(join(root, 'apps/mobile/src')),
      ...scan(join(root, 'infra')),
    ].filter((f) => !f.includes(`${join('apps', 'mobile', 'src', 'testing')}`));
    expect(files.length).toBeGreaterThan(20);
    const literal = /otp[A-Za-z_]*\s*[:=]\s*['"`]\d{6}['"`]/i;
    const offenders = files.filter((f) => literal.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
