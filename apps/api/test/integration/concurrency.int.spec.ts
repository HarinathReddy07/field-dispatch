import {
  ACCOUNTS,
  REQUESTER_ID,
  TECH_ID,
  TestCtx,
  createTestApp,
  idemKey,
  newRequestBody,
} from '../support/app';

const API = '/api/v1';
const ITERATIONS = Number(process.env.CONCURRENCY_ITERATIONS ?? 20);

describe('concurrent confirmation (A4)', () => {
  let ctx: TestCtx;
  let tokens: string[];

  beforeAll(async () => {
    ctx = await createTestApp();
    tokens = await Promise.all(
      [ACCOUNTS.requester1, ACCOUNTS.requester2, ACCOUNTS.requester3].map((e) => ctx.login(e)),
    );
  });
  afterAll(() => ctx.close());

  /** Creates a request and runs the nearby search so it is MATCHED (the only state confirm accepts). */
  const create = async (token: string) => {
    const auth = { Authorization: `Bearer ${token}` };
    const id = (await ctx.http().post(`${API}/requests`).set(auth).send(newRequestBody())).body.id as string;
    await ctx.http().get(`${API}/requests/${id}/nearby-technicians`).set(auth);
    return id;
  };

  const confirm = (token: string, id: string, technicianId: string) =>
    ctx
      .http()
      .post(`${API}/requests/${id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idemKey())
      .send({ technicianId });

  /** Test-fixture reset between iterations (not part of any product flow). */
  const resetTechnician = async (n: number) => {
    await ctx.sql(
      `UPDATE assignments SET status = 'CANCELLED', ended_at = now() WHERE technician_id = $1 AND status = 'ACTIVE'`,
      [TECH_ID(n)],
    );
    await ctx.sql(`UPDATE technicians SET availability_status = 'AVAILABLE' WHERE user_id = $1`, [
      TECH_ID(n),
    ]);
  };

  it(`10 parallel confirms on the SAME request -> exactly one winner (x${ITERATIONS})`, async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const id = await create(tokens[0]!);
      const results = await Promise.all(
        Array.from({ length: 10 }, () => confirm(tokens[0]!, id, TECH_ID(1))),
      );
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(9);
      for (const r of results.filter((x) => x.status === 409)) expect(r.body.code).toBe('STATE_CONFLICT');

      const active = await ctx.sql(`SELECT 1 FROM assignments WHERE request_id = $1 AND status = 'ACTIVE'`, [
        id,
      ]);
      expect(active).toHaveLength(1);
      const events = await ctx.sql(`SELECT 1 FROM job_events WHERE request_id = $1 AND action = 'CONFIRM'`, [
        id,
      ]);
      expect(events).toHaveLength(1);
      await resetTechnician(1);
    }
  });

  it(`10 competing requests confirm the SAME technician -> exactly one winner (x${ITERATIONS})`, async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const ids = await Promise.all(Array.from({ length: 10 }, (_, k) => create(tokens[k % 3]!)));
      const results = await Promise.all(ids.map((id, k) => confirm(tokens[k % 3]!, id, TECH_ID(1))));
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(9);
      for (const r of results.filter((x) => x.status === 409))
        expect(r.body.code).toBe('TECHNICIAN_UNAVAILABLE');

      const active = await ctx.sql(
        `SELECT 1 FROM assignments WHERE technician_id = $1 AND status = 'ACTIVE'`,
        [TECH_ID(1)],
      );
      expect(active).toHaveLength(1);
      // Losers are untouched: still searchable, no assignment, no CONFIRM event.
      const states = await ctx.sql<{ state: string }>(
        `SELECT state FROM service_requests WHERE id = ANY($1::uuid[])`,
        [ids],
      );
      expect(states.filter((s) => s.state === 'CONFIRMED')).toHaveLength(1);
      expect(states.filter((s) => s.state === 'MATCHED')).toHaveLength(9);
      const confirms = await ctx.sql(
        `SELECT 1 FROM job_events WHERE request_id = ANY($1::uuid[]) AND action = 'CONFIRM'`,
        [ids],
      );
      expect(confirms).toHaveLength(1);
      await resetTechnician(1);
    }
  });

  it('retries with the same Idempotency-Key in parallel run once and replay the result', async () => {
    const id = await create(tokens[0]!);
    const key = idemKey();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        ctx
          .http()
          .post(`${API}/requests/${id}/confirm`)
          .set('Authorization', `Bearer ${tokens[0]}`)
          .set('Idempotency-Key', key)
          .send({ technicianId: TECH_ID(4) }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual(Array(8).fill(200));
    for (const r of results) expect(r.body).toEqual(results[0]!.body); // jsonb may reorder keys; compare structurally
    expect(await ctx.sql(`SELECT 1 FROM assignments WHERE request_id = $1`, [id])).toHaveLength(1);
    expect(
      await ctx.sql(`SELECT 1 FROM job_events WHERE request_id = $1 AND action = 'CONFIRM'`, [id]),
    ).toHaveLength(1);
  });

  it('database constraints independently reject double booking', async () => {
    const id1 = await create(tokens[0]!);
    const id2 = await create(tokens[1]!);
    await ctx.sql(
      `INSERT INTO assignments (request_id, technician_id, status, time_window, quote_minor)
       VALUES ($1, $2, 'ACTIVE', tstzrange(now(), now() + interval '1 hour'), 1000)`,
      [id1, TECH_ID(2)],
    );
    await expect(
      ctx.sql(
        `INSERT INTO assignments (request_id, technician_id, status, time_window, quote_minor)
         VALUES ($1, $2, 'ACTIVE', tstzrange(now() + interval '10 minutes', now() + interval '2 hours'), 1000)`,
        [id2, TECH_ID(2)],
      ),
    ).rejects.toMatchObject({ code: expect.stringMatching(/^(23505|23P01)$/) });
    expect(REQUESTER_ID(1)).toBeTruthy();
  });
});
