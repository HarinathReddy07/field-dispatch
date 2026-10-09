import { ACCOUNTS, DEV_PASSWORD, TECH_ID, TestCtx, createTestApp } from '../support/app';

const API = '/api/v1';

describe('auth', () => {
  let ctx: TestCtx;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  const login = (email: string, password: string) =>
    ctx.http().post(`${API}/auth/login`).send({ email, password });

  it('logs in seeded accounts and derives the role server-side', async () => {
    const res = await login(ACCOUNTS.tech1, DEV_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: TECH_ID(1), role: 'TECHNICIAN' });
    expect(res.body.expiresIn).toBeGreaterThan(0);
    expect(res.body.accessToken.split('.')).toHaveLength(3);
    const upper = await login(ACCOUNTS.tech1.toUpperCase(), DEV_PASSWORD);
    expect(upper.status).toBe(200);
  });

  it('rejects wrong password, unknown user and disabled user identically', async () => {
    const wrong = await login(ACCOUNTS.tech1, 'nope');
    const unknown = await login('ghost@dispatch.test', 'nope');
    await ctx.sql(`UPDATE users SET status = 'DISABLED' WHERE email = $1`, [ACCOUNTS.tech3]);
    const disabled = await login(ACCOUNTS.tech3, DEV_PASSWORD);
    for (const r of [wrong, unknown, disabled]) {
      expect(r.status).toBe(401);
      expect(r.body.message).toBe('Invalid credentials');
    }
    const audit = await ctx.sql<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_logs WHERE action = 'auth.login_failed'`,
    );
    expect(audit[0]!.n).toBeGreaterThanOrEqual(3);
  });

  it('a disabled user with a previously valid token is rejected', async () => {
    const token = await ctx.login(ACCOUNTS.tech4);
    expect((await ctx.http().get(`${API}/auth/me`).set('Authorization', `Bearer ${token}`)).status).toBe(200);
    await ctx.sql(`UPDATE users SET status = 'DISABLED' WHERE email = $1`, [ACCOUNTS.tech4]);
    expect((await ctx.http().get(`${API}/auth/me`).set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const first = (await login(ACCOUNTS.requester3, DEV_PASSWORD)).body;
    const second = await ctx.http().post(`${API}/auth/refresh`).send({ refreshToken: first.refreshToken });
    expect(second.status).toBe(200);
    expect(second.body.refreshToken).not.toBe(first.refreshToken);

    const stored = await ctx.sql<{ token_hash: string }>(`SELECT token_hash FROM refresh_tokens`);
    expect(stored.every((r) => r.token_hash.length === 64 && r.token_hash !== first.refreshToken)).toBe(true); // hashed, never raw

    const reuse = await ctx.http().post(`${API}/auth/refresh`).send({ refreshToken: first.refreshToken });
    expect(reuse.status).toBe(401);
    const afterReuse = await ctx
      .http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: second.body.refreshToken });
    expect(afterReuse.status).toBe(401); // whole family revoked
    expect(
      (
        await ctx
          .http()
          .post(`${API}/auth/refresh`)
          .send({ refreshToken: 'x'.repeat(40) })
      ).status,
    ).toBe(401);
  });

  it('rate limits login attempts (Redis-backed)', async () => {
    const limited = await createTestApp({ env: { THROTTLE_LOGIN_PER_MIN: '8' }, seedData: false });
    try {
      const attempt = () =>
        limited.http().post('/api/v1/auth/login').send({ email: 'brute@dispatch.test', password: 'x' });
      const statuses: number[] = [];
      for (let i = 0; i < 12; i++) statuses.push((await attempt()).status);
      expect(statuses.slice(0, 8).every((s) => s === 401)).toBe(true);
      expect(statuses).toEqual([...Array(8).fill(401), ...Array(4).fill(429)]);
      expect((await attempt()).body.code).toBe('RATE_LIMITED');
    } finally {
      await limited.close();
    }
  });

  it('serves liveness/readiness', async () => {
    expect((await ctx.http().get('/health/live')).status).toBe(200);
    const ready = await ctx.http().get('/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.checks).toEqual({ database: true, redis: true });
  });

  it('exposes OpenAPI/Swagger only when SWAGGER_ENABLED=true (off by default)', async () => {
    expect((await ctx.http().get('/api/docs-json')).status).toBe(404);
    expect((await ctx.http().get('/api/docs')).status).toBe(404);
    const withDocs = await createTestApp({ env: { SWAGGER_ENABLED: 'true' }, seedData: false });
    try {
      const docs = await withDocs.http().get('/api/docs-json');
      expect(docs.status).toBe(200);
      expect(Object.keys(docs.body.paths)).toEqual(
        expect.arrayContaining(['/api/v1/requests', '/api/v1/requests/{id}/confirm']),
      );
    } finally {
      await withDocs.close();
    }
  });

  it('technician availability and location ingestion', async () => {
    const t = await ctx.login(ACCOUNTS.tech2);
    const off = await ctx
      .http()
      .patch(`${API}/technicians/me/availability`)
      .set('Authorization', `Bearer ${t}`)
      .send({ status: 'OFFLINE' });
    expect(off.body.status).toBe('OFFLINE');
    expect(
      (
        await ctx
          .http()
          .patch(`${API}/technicians/me/availability`)
          .set('Authorization', `Bearer ${t}`)
          .send({ status: 'BUSY' })
      ).status,
    ).toBe(400);
    const ping = await ctx
      .http()
      .post(`${API}/technicians/me/location`)
      .set('Authorization', `Bearer ${t}`)
      .send({ lat: 12.97, lon: 77.64 });
    expect(ping.status).toBe(202);
    expect(ping.body.persisted).toBe(true);
    const again = await ctx
      .http()
      .post(`${API}/technicians/me/location`)
      .set('Authorization', `Bearer ${t}`)
      .send({ lat: 12.971, lon: 77.641 });
    expect(again.body.persisted).toBe(false); // throttled persistence
    const busy = await ctx.login(ACCOUNTS.tech7);
    const res = await ctx
      .http()
      .patch(`${API}/technicians/me/availability`)
      .set('Authorization', `Bearer ${busy}`)
      .send({ status: 'AVAILABLE' });
    expect(res.status).toBe(409);
  });
});
