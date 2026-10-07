import { createHmac, randomUUID } from 'node:crypto';
import { ACCOUNTS, TECH_ID, TestCtx, createTestApp, idemKey, newRequestBody } from '../support/app';

const API = '/api/v1';

function forgeJwt(sub: string, secret: string, alg: 'HS256' | 'none' = 'HS256'): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg, typ: 'JWT' });
  const body = b64({ sub, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 });
  if (alg === 'none') return `${head}.${body}.`;
  return `${head}.${body}.${createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')}`;
}

describe('security: authn/authz, input validation, information hiding', () => {
  let ctx: TestCtx;
  let r1: string, r2: string, tech1: string, tech2: string, admin: string;
  let requestId: string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    const t = await Promise.all(
      [ACCOUNTS.requester1, ACCOUNTS.requester2, ACCOUNTS.tech1, ACCOUNTS.tech2, ACCOUNTS.admin].map((e) =>
        ctx.login(e),
      ),
    );
    [r1, r2, tech1, tech2, admin] = [t[0]!, t[1]!, t[2]!, t[3]!, t[4]!];
    requestId = (await ctx.http().post(`${API}/requests`).set(auth(r1)).send(newRequestBody())).body.id;
  });
  afterAll(() => ctx.close());

  describe('IDOR / information hiding (A5)', () => {
    it('another requester gets 404 identical to a non-existent id', async () => {
      const other = await ctx.http().get(`${API}/requests/${requestId}`).set(auth(r2));
      const missing = await ctx.http().get(`${API}/requests/${randomUUID()}`).set(auth(r2));
      expect(other.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(other.body.code).toBe('NOT_FOUND');
      expect(other.body.message).toBe(missing.body.message);
      expect(JSON.stringify(other.body)).not.toContain('assetId');
    });

    it('an unassigned technician cannot read the request, snapshot or search results', async () => {
      expect((await ctx.http().get(`${API}/requests/${requestId}`).set(auth(tech2))).status).toBe(404);
      expect((await ctx.http().get(`${API}/requests/${requestId}/snapshot`).set(auth(tech2))).status).toBe(
        404,
      );
      expect(
        (await ctx.http().get(`${API}/requests/${requestId}/nearby-technicians`).set(auth(tech2))).status,
      ).toBe(403);
    });

    it("another requester cannot search or confirm someone else's request", async () => {
      expect(
        (await ctx.http().get(`${API}/requests/${requestId}/nearby-technicians`).set(auth(r2))).status,
      ).toBe(404);
      const res = await ctx
        .http()
        .post(`${API}/requests/${requestId}/confirm`)
        .set(auth(r2))
        .set('Idempotency-Key', idemKey())
        .send({ technicianId: TECH_ID(1) });
      expect(res.status).toBe(404);
    });

    it('the owner and an admin can read it', async () => {
      expect((await ctx.http().get(`${API}/requests/${requestId}`).set(auth(r1))).status).toBe(200);
      expect((await ctx.http().get(`${API}/requests/${requestId}`).set(auth(admin))).status).toBe(200);
    });

    it('history never includes other users requests', async () => {
      const res = await ctx.http().get(`${API}/requests/history`).set(auth(r2));
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('a technician only sees their own profile fields via /users/me', async () => {
      const me = await ctx.http().get(`${API}/users/me`).set(auth(tech1));
      expect(Object.keys(me.body).sort()).toEqual(['id', 'name', 'rating', 'role']);
      expect(JSON.stringify(me.body)).not.toMatch(/password|hash|email/i);
    });
  });

  describe('role enforcement and privilege escalation', () => {
    it('a technician cannot create requests; a requester cannot hit technician routes', async () => {
      expect((await ctx.http().post(`${API}/requests`).set(auth(tech1)).send(newRequestBody())).status).toBe(
        403,
      );
      expect(
        (
          await ctx
            .http()
            .patch(`${API}/technicians/me/availability`)
            .set(auth(r1))
            .send({ status: 'AVAILABLE' })
        ).status,
      ).toBe(403);
    });

    it('rejects a role supplied by the client in any payload', async () => {
      const a = await ctx
        .http()
        .post(`${API}/requests`)
        .set(auth(r1))
        .send({ ...newRequestBody(), role: 'ADMIN' });
      expect(a.status).toBe(400);
      expect(a.body.code).toBe('VALIDATION_FAILED');
      const b = await ctx
        .http()
        .post(`${API}/auth/login`)
        .send({ email: ACCOUNTS.requester1, password: 'x', role: 'ADMIN' });
      expect(b.status).toBe(400);
    });

    it('role comes from the database, not the token: forged tokens are rejected', async () => {
      const wrongSecret = forgeJwt(ACCOUNTS.admin, 'z'.repeat(48));
      expect((await ctx.http().get(`${API}/auth/me`).set(auth(wrongSecret))).status).toBe(401);
      const none = forgeJwt(randomUUID(), '', 'none');
      expect((await ctx.http().get(`${API}/auth/me`).set(auth(none))).status).toBe(401);
      const validSigButUnknownUser = forgeJwt(randomUUID(), 'j'.repeat(48));
      expect((await ctx.http().get(`${API}/auth/me`).set(auth(validSigButUnknownUser))).status).toBe(401);
    });

    it('requires authentication and returns the error envelope with a correlation id', async () => {
      const res = await ctx
        .http()
        .get(`${API}/requests/${requestId}`)
        .set('x-correlation-id', 'corr-test-12345');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
        correlationId: 'corr-test-12345',
      });
      expect(res.headers['x-correlation-id']).toBe('corr-test-12345');
      const bad = await ctx.http().get(`${API}/auth/me`).set('Authorization', 'Basic abc');
      expect(bad.status).toBe(401);
    });

    it('generates a correlation id when none (or an invalid one) is supplied', async () => {
      const res = await ctx.http().get(`${API}/auth/me`).set('x-correlation-id', 'bad id with spaces!');
      expect(res.body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('mass assignment and malformed payloads', () => {
    it.each([
      ['protected state field', { state: 'COMPLETED' }],
      ['protected quote field', { quoteMinor: 1 }],
      ['another requester id', { requesterId: randomUUID() }],
      ['version', { version: 99 }],
    ])('rejects %s on create', async (_n, extra) => {
      const res = await ctx
        .http()
        .post(`${API}/requests`)
        .set(auth(r1))
        .send({ ...newRequestBody(), ...extra });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(JSON.stringify(res.body)).not.toContain('COMPLETED');
    });

    it('rejects client-supplied price on confirm', async () => {
      const res = await ctx
        .http()
        .post(`${API}/requests/${requestId}/confirm`)
        .set(auth(r1))
        .set('Idempotency-Key', idemKey())
        .send({ technicianId: TECH_ID(1), quoteMinor: 1 });
      expect(res.status).toBe(400);
    });

    it.each([
      ['bad latitude', { location: { lat: 999, lon: 77 } }],
      ['bad category', { category: 'PLUMBING' }],
      ['window end before start', { windowStart: '2031-01-02T00:00:00Z', windowEnd: '2031-01-01T00:00:00Z' }],
      ['window in the past', { windowStart: '2001-01-01T00:00:00Z', windowEnd: '2001-01-01T01:00:00Z' }],
      [
        'window over 24h',
        {
          windowStart: new Date(Date.now() + 3600e3).toISOString(),
          windowEnd: new Date(Date.now() + 50 * 3600e3).toISOString(),
        },
      ],
      ['non-string asset', { assetId: { $ne: null } }],
      ['empty asset', { assetId: '   ' }],
    ])('rejects %s', async (_n, patch) => {
      const res = await ctx
        .http()
        .post(`${API}/requests`)
        .set(auth(r1))
        .send({ ...newRequestBody(), ...patch });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('rejects malformed JSON and oversized bodies without leaking internals', async () => {
      const bad = await ctx
        .http()
        .post(`${API}/requests`)
        .set(auth(r1))
        .set('Content-Type', 'application/json')
        .send('{"assetId":');
      expect(bad.status).toBe(400);
      expect(bad.body.code).toBe('VALIDATION_FAILED');
      expect(JSON.stringify(bad.body)).not.toMatch(/stack|SyntaxError|at /);
      const big = await ctx
        .http()
        .post(`${API}/requests`)
        .set(auth(r1))
        .send(newRequestBody({ notes: 'x'.repeat(200_000) }));
      expect(big.status).toBe(413);
    });

    it('rejects a malformed uuid with 400 and never reaches SQL', async () => {
      const res = await ctx.http().get(`${API}/requests/not-a-uuid`).set(auth(r1));
      expect(res.status).toBe(400);
    });
  });

  describe('SQL injection baseline', () => {
    it('stores hostile strings as data and leaves the schema intact', async () => {
      const payload = `'); DROP TABLE service_requests; --`;
      const res = await ctx
        .http()
        .post(`${API}/requests`)
        .set(auth(r1))
        .send(newRequestBody({ assetId: payload, notes: payload }));
      expect(res.status).toBe(201);
      expect(res.body.assetId).toBe(payload);
      const rows = await ctx.sql(`SELECT count(*)::int AS n FROM service_requests`);
      expect(rows[0]).toBeDefined();
    });

    it.each([
      ['radiusKm', '1 OR 1=1'],
      ['radiusKm', '1; DROP TABLE users'],
      ['limit', "5' OR '1'='1"],
    ])('rejects injected %s=%s in query filters', async (key, value) => {
      const res = await ctx
        .http()
        .get(`${API}/requests/${requestId}/nearby-technicians`)
        .set(auth(r1))
        .query({ [key]: value });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('rejects injected pagination and unknown query keys', async () => {
      expect(
        (await ctx.http().get(`${API}/requests/history`).set(auth(r1)).query({ page: '1; DROP TABLE users' }))
          .status,
      ).toBe(400);
      expect(
        (await ctx.http().get(`${API}/requests/history`).set(auth(r1)).query({ page: 1, admin: 'true' }))
          .status,
      ).toBe(400);
    });

    it('login with an injection-style email is a plain 401/400, not an error', async () => {
      const res = await ctx
        .http()
        .post(`${API}/auth/login`)
        .send({ email: "' OR 1=1 --@x.com", password: 'x' });
      expect([400, 401]).toContain(res.status);
      expect(await ctx.sql(`SELECT count(*)::int AS n FROM users`)).toEqual([{ n: 12 }]);
    });
  });
});
