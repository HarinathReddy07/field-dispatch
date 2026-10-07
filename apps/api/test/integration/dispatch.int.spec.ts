import { ACCOUNTS, TECH_ID, TestCtx, createTestApp, idemKey, newRequestBody } from '../support/app';

const API = '/api/v1';

describe('create -> nearby -> confirm', () => {
  let ctx: TestCtx;
  let requester: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    requester = await ctx.login(ACCOUNTS.requester1);
  });
  afterAll(() => ctx.close());

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('creates a request, ranks eligible technicians, confirms atomically and idempotently', async () => {
    const created = await ctx.http().post(`${API}/requests`).set(auth(requester)).send(newRequestBody());
    expect(created.status).toBe(201);
    expect(created.body.state).toBe('REQUESTED');
    const id = created.body.id as string;

    const nearby = await ctx.http().get(`${API}/requests/${id}/nearby-technicians`).set(auth(requester));
    expect(nearby.status).toBe(200);
    const list = nearby.body as { technicianId: string; distanceKm: number; quoteMinor: number }[];
    // Eligible for ELECTRICAL near MG Road: Anil, Bhavna, Divya, Harish. Excluded: stale, offline, busy, mechanical-only.
    expect(list.map((t) => t.technicianId)).toEqual(
      expect.arrayContaining([TECH_ID(1), TECH_ID(2), TECH_ID(4), TECH_ID(8)]),
    );
    expect(list.map((t) => t.technicianId)).not.toEqual(expect.arrayContaining([TECH_ID(3)]));
    for (const excluded of [3, 5, 6, 7])
      expect(list.map((t) => t.technicianId)).not.toContain(TECH_ID(excluded));
    expect(list[0]!.technicianId).toBe(TECH_ID(1)); // nearest
    expect([...list].sort((a, b) => a.distanceKm - b.distanceKm)).toEqual(list);
    expect(Object.keys(list[0]!).sort()).toEqual([
      'availability',
      'distanceKm',
      'name',
      'quoteMinor',
      'rating',
      'technicianId',
    ]);

    const stateAfterSearch = await ctx.http().get(`${API}/requests/${id}`).set(auth(requester));
    expect(stateAfterSearch.body.state).toBe('MATCHED');

    const key = idemKey();
    const confirm = () =>
      ctx
        .http()
        .post(`${API}/requests/${id}/confirm`)
        .set(auth(requester))
        .set('Idempotency-Key', key)
        .send({ technicianId: TECH_ID(1) });
    const first = await confirm();
    expect(first.status).toBe(200);
    expect(first.body.state).toBe('CONFIRMED');
    expect(first.body.technician.id).toBe(TECH_ID(1));
    expect(first.body.quoteMinor).toBe(list[0]!.quoteMinor); // server quote == quote shown in options

    const replay = await confirm();
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);

    const mismatch = await ctx
      .http()
      .post(`${API}/requests/${id}/confirm`)
      .set(auth(requester))
      .set('Idempotency-Key', key)
      .send({ technicianId: TECH_ID(2) });
    expect(mismatch.status).toBe(422);
    expect(mismatch.body.code).toBe('IDEMPOTENCY_MISMATCH');

    const noKey = await ctx
      .http()
      .post(`${API}/requests/${id}/confirm`)
      .set(auth(requester))
      .send({ technicianId: TECH_ID(1) });
    expect(noKey.status).toBe(400);
    expect(noKey.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

    const assignments = await ctx.sql(`SELECT 1 FROM assignments WHERE request_id = $1`, [id]);
    expect(assignments).toHaveLength(1);
    const events = await ctx.sql<{ action: string }>(
      `SELECT action FROM job_events WHERE request_id = $1 ORDER BY seq`,
      [id],
    );
    expect(events.map((e) => e.action)).toEqual(['CREATE', 'SUBMIT', 'SEARCH', 'CONFIRM']);
    const audit = await ctx.sql<{ action: string }>(
      `SELECT action FROM audit_logs WHERE request_id = $1 ORDER BY seq`,
      [id],
    );
    expect(audit.map((a) => a.action)).toEqual([
      'request.create',
      'request.submit',
      'request.search',
      'request.confirm',
      'assignment.create',
    ]);
    const outbox = await ctx.sql<{ type: string }>(
      `SELECT type FROM outbox_events WHERE request_id = $1 ORDER BY seq`,
      [id],
    );
    expect(outbox.map((o) => o.type)).toEqual([
      'request.state.changed', // DRAFT -> REQUESTED
      'request.created',
      'request.state.changed', // REQUESTED -> MATCHED
      'request.state.changed', // MATCHED -> CONFIRMED
      'assignment.created',
    ]);
    const tech = await ctx.sql<{ availability_status: string }>(
      `SELECT availability_status FROM technicians WHERE user_id = $1`,
      [TECH_ID(1)],
    );
    expect(tech[0]!.availability_status).toBe('BUSY');
  });

  it('rejects confirming an ineligible technician and a closed request', async () => {
    const r = await ctx.http().post(`${API}/requests`).set(auth(requester)).send(newRequestBody());
    const id = r.body.id as string;
    // confirming before searching is refused: the booking must come from a MATCHED request
    const early = await ctx
      .http()
      .post(`${API}/requests/${id}/confirm`)
      .set(auth(requester))
      .set('Idempotency-Key', idemKey())
      .send({ technicianId: TECH_ID(1) });
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('STATE_CONFLICT');
    await ctx.http().get(`${API}/requests/${id}/nearby-technicians`).set(auth(requester));
    for (const n of [3, 5, 6, 7]) {
      const res = await ctx
        .http()
        .post(`${API}/requests/${id}/confirm`)
        .set(auth(requester))
        .set('Idempotency-Key', idemKey())
        .send({ technicianId: TECH_ID(n) });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('TECHNICIAN_UNAVAILABLE');
    }
  });

  it('exposes history and reorder for finished requests', async () => {
    const history = await ctx.http().get(`${API}/requests/history`).set(auth(requester));
    expect(history.status).toBe(200);
    expect(history.body.length).toBeGreaterThanOrEqual(1);
    const completed = history.body.find((x: { state: string }) => x.state === 'SETTLED');
    expect(completed.settlement.amountMinor).toBe(52500);

    const reorder = await ctx.http().post(`${API}/requests/${completed.id}/reorder`).set(auth(requester));
    expect(reorder.status).toBe(201);
    expect(reorder.body.state).toBe('REQUESTED');
    expect(reorder.body.assetId).toBe(completed.assetId);
    expect(reorder.body.id).not.toBe(completed.id);

    const notFinished = await ctx
      .http()
      .post(`${API}/requests/${reorder.body.id}/reorder`)
      .set(auth(requester));
    expect(notFinished.status).toBe(409);
  });
});
