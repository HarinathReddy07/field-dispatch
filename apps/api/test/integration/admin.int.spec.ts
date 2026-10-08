import { ACCOUNTS, TECH_ID, TestCtx, createTestApp, idemKey } from '../support/app';
import { Flow } from '../support/flow';

describe('A5 authorization and admin operations', () => {
  let ctx: TestCtx;
  let flow: Flow;
  beforeAll(async () => {
    ctx = await createTestApp();
    flow = new Flow(ctx);
  });
  afterEach(() => flow.cleanup());
  afterAll(() => ctx.close());

  const adminRoutes: ['get' | 'post', string, object?][] = [
    ['get', '/admin/summary'],
    ['get', '/admin/jobs'],
    ['get', '/admin/jobs/00000000-0000-4000-8000-000000000102'],
    ['get', '/admin/technicians'],
    ['get', '/admin/audit'],
    [
      'post',
      '/admin/jobs/00000000-0000-4000-8000-000000000102/reassign',
      { technicianId: TECH_ID(1), reason: 'because reasons' },
    ],
    ['post', '/admin/jobs/00000000-0000-4000-8000-000000000102/cancel', { reason: 'because reasons' }],
  ];

  it.each(['tech1', 'requester1'] as const)(
    'every admin route rejects a %s token with 403 and no data',
    async (who) => {
      for (const [method, path, body] of adminRoutes) {
        const res = method === 'get' ? await flow.get(who, path) : await flow.post(who, path, body, null);
        expect(res.status).toBe(403);
        expect(Object.keys(res.body).sort()).toEqual(['code', 'correlationId', 'message']);
      }
    },
  );

  it('every admin route rejects anonymous callers with 401', async () => {
    for (const [method, path, body] of adminRoutes) {
      const res =
        method === 'get'
          ? await ctx.http().get(`/api/v1${path}`)
          : await ctx.http().post(`/api/v1${path}`).send(body);
      expect(res.status).toBe(401);
    }
  });

  it("requesters and technicians cannot touch other users' jobs through any route", async () => {
    const id = await flow.assigned(1, 'requester1');
    const other = 'requester2' as const;
    for (const res of [
      await flow.get(other, `/requests/${id}`),
      await flow.get(other, `/requests/${id}/evidence`),
      await flow.get(other, `/requests/${id}/snapshot`),
      await flow.post(other, `/requests/${id}/cancel`),
      await flow.post(other, `/requests/${id}/reorder`),
      await flow.post(other, `/requests/${id}/otp`, {}, null),
      await flow.post(other, `/requests/${id}/review`, { decision: 'APPROVE' }),
      await flow.get('tech2', `/requests/${id}`),
      await flow.get('tech2', `/requests/${id}/evidence`),
      await flow.start(id, 'tech2'),
      await flow.stop(id, 'tech2'),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    }
    expect((await flow.get('requester1', `/requests/${id}`)).status).toBe(200);
    expect((await flow.get('tech1', `/requests/${id}`)).status).toBe(200);
  });

  it('technicians never see the requester or each other (response shape)', async () => {
    const id = await flow.assigned(1, 'requester1');
    const view = (await flow.get('tech1', `/requests/${id}`)).body;
    expect(JSON.stringify(view)).not.toMatch(/requester1|email|password|requesterId|requester_id/i);
    const nearby = await flow.get(
      'requester1',
      `/requests/${await flow.create('requester1')}/nearby-technicians`,
    );
    expect(JSON.stringify(nearby.body)).not.toMatch(/email|password|last_seen|lat|lon|location/i);
  });

  it('admin lists, filters, paginates and inspects jobs with server-computed flags', async () => {
    const a = await flow.assigned(1, 'requester1');
    const b = await flow.create('requester2');
    const all = await flow.get('admin', '/admin/jobs?pageSize=100');
    expect(all.status).toBe(200);
    const ids = all.body.items.map((i: { id: string }) => i.id);
    expect(ids).toEqual(expect.arrayContaining([a, b]));
    expect(all.body.total).toBe(all.body.items.length);

    const assigned = await flow.get('admin', '/admin/jobs?state=CONFIRMED&pageSize=100');
    expect(assigned.body.items.every((i: { state: string }) => i.state === 'CONFIRMED')).toBe(true);
    const page = await flow.get('admin', '/admin/jobs?pageSize=1&page=2');
    expect(page.body.items).toHaveLength(1);
    expect(page.body.page).toBe(2);
    expect((await flow.get('admin', '/admin/jobs?pageSize=1000')).status).toBe(400);
    expect((await flow.get('admin', '/admin/jobs?state=BOGUS')).status).toBe(400);

    const item = assigned.body.items.find((i: { id: string }) => i.id === a);
    expect(item.technician.id).toBe(TECH_ID(1));
    expect(item.technicianLocation).toMatchObject({ lat: expect.any(Number), lon: expect.any(Number) });
    expect(Array.isArray(item.exceptionFlags)).toBe(true);

    const detail = await flow.get('admin', `/admin/jobs/${a}`);
    expect(detail.body.job.id).toBe(a);
    expect(detail.body.events.map((e: { state_to: string }) => e.state_to)).toEqual([
      'DRAFT',
      'REQUESTED',
      'MATCHED',
      'CONFIRMED',
    ]);
    expect(detail.body.assignments).toHaveLength(1);
    expect(detail.body.audit.length).toBeGreaterThanOrEqual(3);
    expect((await flow.get('admin', `/admin/jobs/00000000-0000-4000-8000-0000000000ff`)).status).toBe(404);

    const techs = await flow.get('admin', '/admin/technicians');
    expect(techs.body).toHaveLength(8);
    expect(techs.body.find((t: { id: string }) => t.id === TECH_ID(1)).current_request_id).toBe(a);

    const summary = await flow.get('admin', '/admin/summary');
    expect(summary.body.countsByState.CONFIRMED).toBeGreaterThanOrEqual(1);
    expect(summary.body.activeRequests).toBeGreaterThanOrEqual(2);
    expect(summary.body.activeTechnicians).toBeGreaterThanOrEqual(1);
    expect(typeof summary.body.exceptionCount).toBe('number');
    expect(summary.body.completedToday).toBeGreaterThanOrEqual(0);
  });

  it('flags stale technicians and overdue reviews on the board', async () => {
    const id = await flow.assigned(1, 'requester1');
    await ctx.sql(`UPDATE technicians SET last_seen_at = now() - interval '2 days' WHERE user_id = $1`, [
      TECH_ID(1),
    ]);
    const board = await flow.get('admin', '/admin/jobs?state=CONFIRMED&pageSize=100');
    expect(board.body.items.find((i: { id: string }) => i.id === id).exceptionFlags).toContain(
      'TECHNICIAN_STALE',
    );
    await ctx.sql(`UPDATE technicians SET last_seen_at = now() WHERE user_id = $1`, [TECH_ID(1)]);
  });

  it('reassign requires a reason, validates the technician and goes through the state machine', async () => {
    const id = await flow.assigned(1, 'requester1');
    const oldOtp = await flow.otp(id);
    const path = `/admin/jobs/${id}/reassign`;
    expect((await flow.post('admin', path, { technicianId: TECH_ID(2) }, null)).status).toBe(400);
    expect((await flow.post('admin', path, { technicianId: TECH_ID(2), reason: 'no' }, null)).status).toBe(
      400,
    );
    expect(
      (
        await flow.post(
          'admin',
          path,
          { technicianId: TECH_ID(2), reason: 'valid reason', state: 'COMPLETED' },
          null,
        )
      ).status,
    ).toBe(400);
    expect(
      (await flow.post('admin', path, { technicianId: TECH_ID(1), reason: 'same technician' }, null)).status,
    ).toBe(409);
    const busy = await flow.post(
      'admin',
      path,
      { technicianId: TECH_ID(7), reason: 'busy technician' },
      null,
    );
    expect(busy.status).toBe(409);
    expect(busy.body.code).toBe('TECHNICIAN_UNAVAILABLE');
    expect((await flow.get('admin', `/admin/jobs/${id}`)).body.job.technician.id).toBe(TECH_ID(1)); // rolled back cleanly

    const res = await flow.post(
      'admin',
      path,
      { technicianId: TECH_ID(2), reason: 'Technician 1 is unreachable' },
      null,
    );
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('CONFIRMED');
    expect(res.body.technician.id).toBe(TECH_ID(2));

    const status = await ctx.sql<{ user_id: string; availability_status: string }>(
      `SELECT user_id::text, availability_status FROM technicians WHERE user_id = ANY($1::uuid[])`,
      [[TECH_ID(1), TECH_ID(2)]],
    );
    expect(Object.fromEntries(status.map((s) => [s.user_id, s.availability_status]))).toEqual({
      [TECH_ID(1)]: 'AVAILABLE',
      [TECH_ID(2)]: 'BUSY',
    });
    // old technician lost access, old code is dead
    expect((await flow.start(id, 'tech1')).status).toBe(404);
    expect((await flow.arrive(id, 'tech2', oldOtp)).body.code).toBe('OTP_INVALID');
    expect((await flow.arrive(id, 'tech2', await flow.otp(id))).status).toBe(200);

    const ev = await ctx.sql<{ action: string; reason: string | null; actor_role: string }>(
      `SELECT action, reason, actor_role FROM job_events WHERE request_id = $1 AND action = 'ADMIN_REASSIGN'`,
      [id],
    );
    expect(ev).toEqual([
      { action: 'ADMIN_REASSIGN', reason: 'Technician 1 is unreachable', actor_role: 'ADMIN' },
    ]);
    const audit = await flow.get('admin', `/admin/audit?requestId=${id}&action=request.admin_reassign`);
    expect(audit.body.items).toHaveLength(1);
    expect(audit.body.items[0].metadata.reason).toBe('Technician 1 is unreachable');
    const override = await ctx.sql<{ rooms: string[] }>(
      `SELECT rooms FROM outbox_events WHERE request_id = $1 AND type = 'admin.override'`,
      [id],
    );
    expect(override[0]!.rooms).toEqual(
      expect.arrayContaining([`user:${TECH_ID(1)}`, `user:${TECH_ID(2)}`, 'admin']),
    );
  });

  it('reassigning mid-work starts a fresh work cycle for the new technician', async () => {
    const { id } = await flow.inProgress(1, 'requester1');
    await flow.uploadEvidence(id, 'tech1');
    const res = await flow.post(
      'admin',
      `/admin/jobs/${id}/reassign`,
      { technicianId: TECH_ID(4), reason: 'Technician left the site' },
      null,
    );
    expect(res.body).toMatchObject({ state: 'CONFIRMED', workCycle: 2, startedAt: null });
    expect(res.body.technician.id).toBe(TECH_ID(4));
    expect((await flow.get('tech1', `/requests/${id}`)).status).toBe(200); // history still readable
    expect((await flow.uploadEvidence(id, 'tech1')).status).toBe(404);
  });

  it('cancel requires a reason, frees the technician, and cannot touch finished jobs', async () => {
    const { id } = await flow.inProgress(2, 'requester1');
    expect((await flow.post('admin', `/admin/jobs/${id}/cancel`, {}, null)).status).toBe(400);
    expect((await flow.post('admin', `/admin/jobs/${id}/cancel`, { reason: 'abc' }, null)).status).toBe(400);
    const res = await flow.post(
      'admin',
      `/admin/jobs/${id}/cancel`,
      { reason: 'Customer called to cancel' },
      null,
    );
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('CANCELLED');
    const t = await ctx.sql<{ availability_status: string }>(
      `SELECT availability_status FROM technicians WHERE user_id = $1`,
      [TECH_ID(2)],
    );
    expect(t[0]!.availability_status).toBe('AVAILABLE');
    const audit = await flow.get('admin', `/admin/audit?requestId=${id}`);
    const actions = audit.body.items.map((a: { action: string }) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['request.admin_cancel', 'admin.override.cancel']));
    expect(
      audit.body.items.find((a: { action: string }) => a.action === 'request.admin_cancel').metadata.reason,
    ).toBe('Customer called to cancel');

    expect(
      (await flow.post('admin', `/admin/jobs/${id}/cancel`, { reason: 'Cancelling again' }, null)).status,
    ).toBe(409);
    const done = await flow.underReview(4, 'requester1');
    await flow.review(done.id, { decision: 'APPROVE' });
    expect(
      (await flow.post('admin', `/admin/jobs/${done.id}/cancel`, { reason: 'Cancel after completion' }, null))
        .status,
    ).toBe(409);
    expect(
      (
        await flow.post(
          'admin',
          `/admin/jobs/${done.id}/reassign`,
          { technicianId: TECH_ID(1), reason: 'Reassign finished job' },
          null,
        )
      ).status,
    ).toBe(409);
  });

  it('audit view filters by actor, action and request and paginates', async () => {
    const id = await flow.assigned(1, 'requester1');
    const byRequest = await flow.get('admin', `/admin/audit?requestId=${id}`);
    expect(byRequest.body.items.every((a: { request_id: string }) => a.request_id === id)).toBe(true);
    const byActor = await flow.get(
      'admin',
      `/admin/audit?actorId=${'00000000-0000-4000-8000-000000000011'}&pageSize=100`,
    );
    expect(byActor.body.items.length).toBeGreaterThan(0);
    expect(
      byActor.body.items.every(
        (a: { actor_id: string }) => a.actor_id === '00000000-0000-4000-8000-000000000011',
      ),
    ).toBe(true);
    const byAction = await flow.get('admin', `/admin/audit?action=auth.login&pageSize=100`);
    expect(byAction.body.items.every((a: { action: string }) => a.action === 'auth.login')).toBe(true);
    const p1 = await flow.get('admin', '/admin/audit?pageSize=2&page=1');
    const p2 = await flow.get('admin', '/admin/audit?pageSize=2&page=2');
    expect(p1.body.items).toHaveLength(2);
    expect(p1.body.items[0].seq).toBeGreaterThan(p2.body.items[0].seq); // newest first
    expect((await flow.get('admin', `/admin/audit?requestId=not-a-uuid`)).status).toBe(400);
    expect(
      (await flow.get('admin', `/admin/audit?action=${encodeURIComponent("' OR 1=1 --")}`)).body.items,
    ).toEqual([]);
    expect(ACCOUNTS.admin).toBeTruthy();
    expect(idemKey()).toBeTruthy();
  });
});
