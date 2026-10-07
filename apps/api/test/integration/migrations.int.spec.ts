import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { TestDb, createTestDatabase } from '../support/db';

describe('migrations: constraints reject violations', () => {
  let db: TestDb;
  let c: Client;

  beforeAll(async () => {
    db = await createTestDatabase();
    c = new Client({ connectionString: db.url });
    await c.connect();
  });
  afterAll(async () => {
    await c.end();
    await db.drop();
  });

  const user = async (role: string) => {
    const id = randomUUID();
    await c.query(`INSERT INTO users (id,email,password_hash,role,name) VALUES ($1,$2,'x',$3,'n')`, [
      id,
      `${id}@t.test`,
      role,
    ]);
    return id;
  };
  const tech = async () => {
    const id = await user('TECHNICIAN');
    await c.query(
      `INSERT INTO technicians (user_id, service_categories, availability_status, location, last_seen_at)
       VALUES ($1, ARRAY['ELECTRICAL_INSPECTION'], 'AVAILABLE', ST_SetSRID(ST_MakePoint(77.6,12.97),4326)::geography, now())`,
      [id],
    );
    return id;
  };
  const request = async (requesterId: string, extra = '') => {
    const id = randomUUID();
    await c.query(
      `INSERT INTO service_requests (id, requester_id, category, asset_id, location, window_start, window_end ${extra ? ',' + extra.split('=')[0] : ''})
       VALUES ($1,$2,'ELECTRICAL_INSPECTION','A1', ST_SetSRID(ST_MakePoint(77.6,12.97),4326)::geography,
               now(), now() + interval '2 hours' ${extra ? ',' + extra.split('=')[1] : ''})`,
      [id, requesterId],
    );
    return id;
  };
  const assign = (
    requestId: string,
    techId: string,
    window = `[now(), now() + interval '2 hours')`,
    status = 'ACTIVE',
  ) =>
    c.query(
      `INSERT INTO assignments (request_id, technician_id, status, time_window, quote_minor)
       VALUES ($1,$2,$3, tstzrange(${window.slice(1, -1).split(',')[0]}, ${window.slice(1, -1).split(',')[1]}, '[)'), 50000)`,
      [requestId, techId, status],
    );
  const code = async (p: Promise<unknown>) => {
    try {
      await p;
      return 'OK';
    } catch (e) {
      return (e as { code?: string }).code ?? String(e);
    }
  };

  it('has PostGIS, btree_gist and a GiST index on technician location', async () => {
    const ext = await c.query(`SELECT extname FROM pg_extension WHERE extname IN ('postgis','btree_gist')`);
    expect(ext.rows.map((r) => r.extname).sort()).toEqual(['btree_gist', 'postgis']);
    const idx = await c.query(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'technicians_location_gist'`,
    );
    expect(idx.rows[0].indexdef).toMatch(/USING gist/i);
  });

  it('rejects a second ACTIVE assignment for one technician (partial unique)', async () => {
    const r = await user('REQUESTER');
    const t = await tech();
    await assign(await request(r), t);
    expect(
      await code(assign(await request(r), t, `[now() + interval '1 day', now() + interval '2 days')`)),
    ).toBe('23505');
  });

  it('allows a new assignment once the previous one is no longer ACTIVE', async () => {
    const r = await user('REQUESTER');
    const t = await tech();
    await assign(await request(r), t, undefined, 'COMPLETED');
    expect(await code(assign(await request(r), t))).toBe('OK');
  });

  it('exclusion constraint rejects overlapping ACTIVE windows on its own', async () => {
    const r = await user('REQUESTER');
    const t = await tech();
    await assign(await request(r), t);
    await c.query('BEGIN');
    await c.query('DROP INDEX assignments_active_technician_uq'); // isolate the exclusion constraint
    const overlap = await code(
      assign(await request(r), t, `[now() + interval '1 hour', now() + interval '3 hours')`),
    );
    await c.query('ROLLBACK');
    expect(overlap).toBe('23P01');
  });

  it('rejects two ACTIVE assignments for one request', async () => {
    const r = await user('REQUESTER');
    const req = await request(r);
    await assign(req, await tech());
    expect(await code(assign(req, await tech()))).toBe('23505');
  });

  it('blocks UPDATE, DELETE and TRUNCATE on audit_logs', async () => {
    await c.query(
      `INSERT INTO audit_logs (actor_role, action, entity_type, entity_id) VALUES ('SYSTEM','x','y','1')`,
    );
    expect(await code(c.query(`UPDATE audit_logs SET action = 'tampered'`))).toBe('23001');
    expect(await code(c.query(`DELETE FROM audit_logs`))).toBe('23001');
    expect(await code(c.query(`TRUNCATE audit_logs`))).toBe('23001');
  });

  it('blocks UPDATE, DELETE and TRUNCATE on job_events', async () => {
    const req = await request(await user('REQUESTER'));
    await c.query(
      `INSERT INTO job_events (request_id, state_to, action, actor_role) VALUES ($1,'DRAFT','CREATE','SYSTEM')`,
      [req],
    );
    expect(await code(c.query(`UPDATE job_events SET reason = 'x'`))).toBe('23001');
    expect(await code(c.query(`DELETE FROM job_events`))).toBe('23001');
    expect(await code(c.query(`TRUNCATE job_events`))).toBe('23001');
  });

  it('rejects a duplicate settlement for one request (and a reused idempotency key)', async () => {
    const req = await request(await user('REQUESTER'));
    const ins = (key: string) =>
      c.query(
        `INSERT INTO settlements (request_id, amount_minor, idempotency_key, provider_ref) VALUES ($1, 100, $2, 'MOCK')`,
        [req, key],
      );
    await ins('k1');
    expect(await code(ins('k2'))).toBe('23505');
    const req2 = await request(await user('REQUESTER'));
    expect(
      await code(
        c.query(
          `INSERT INTO settlements (request_id, amount_minor, idempotency_key, provider_ref) VALUES ($1, 100, 'k1', 'MOCK')`,
          [req2],
        ),
      ),
    ).toBe('23505');
  });

  it('rejects invalid states, windows and UNDER_REVIEW without a deadline', async () => {
    const r = await user('REQUESTER');
    expect(await code(request(r, `state='BOGUS'`))).toBe('23514');
    expect(
      await code(
        c.query(
          `INSERT INTO service_requests (requester_id, category, asset_id, location, window_start, window_end)
           VALUES ($1,'ELECTRICAL_INSPECTION','A',ST_SetSRID(ST_MakePoint(77.6,12.97),4326)::geography, now(), now() - interval '1 hour')`,
          [r],
        ),
      ),
    ).toBe('23514');
    expect(await code(request(r, `state='UNDER_REVIEW'`))).toBe('23514');
  });

  it('allows only one live OTP challenge per request', async () => {
    const r = await user('REQUESTER');
    const t = await tech();
    const req = await request(r);
    await assign(req, t);
    const a = (await c.query(`SELECT id FROM assignments WHERE request_id = $1`, [req])).rows[0].id;
    const ins = () =>
      c.query(
        `INSERT INTO otp_challenges (request_id, assignment_id, otp_hmac, expires_at) VALUES ($1,$2,'h', now() + interval '5 min')`,
        [req, a],
      );
    await ins();
    expect(await code(ins())).toBe('23505');
    await c.query(`UPDATE otp_challenges SET superseded_at = now() WHERE request_id = $1`, [req]);
    expect(await code(ins())).toBe('OK');
  });

  it('enforces one idempotency record per (scope, key)', async () => {
    const ins = () =>
      c.query(
        `INSERT INTO idempotency_keys (scope, key, request_hash, response_status) VALUES ('s','k','h',200)`,
      );
    await ins();
    expect(await code(ins())).toBe('23505');
  });

  it('migration runner is idempotent', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { migrate } = require('../../../../infra/scripts/migrate.js');
    expect(await migrate(db.url)).toEqual([]);
  });
});
