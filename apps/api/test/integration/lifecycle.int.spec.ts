import { ACCOUNTS, TECH_ID, TestCtx, createTestApp } from '../support/app';
import { Flow } from '../support/flow';

describe('job lifecycle', () => {
  let ctx: TestCtx;
  let flow: Flow;
  beforeAll(async () => {
    ctx = await createTestApp();
    flow = new Flow(ctx);
  });
  afterAll(() => ctx.close());

  it('A1 happy path: request -> assign -> OTP arrival -> work -> 2 images -> approve -> one settlement', async () => {
    const { id, tech } = await flow.arrived(1);
    const started = await flow.start(id, tech);
    expect(started.status).toBe(200);
    expect(started.body.state).toBe('IN_PROGRESS');
    expect(Date.parse(started.body.startedAt)).toBeLessThanOrEqual(Date.parse(started.body.serverTime));
    expect(Date.now() - Date.parse(started.body.startedAt)).toBeLessThan(10_000); // server clock

    const first = await flow.uploadEvidence(id, tech);
    expect(first.body.finalizedCount).toBe(1);
    const early = await flow.stop(id, tech);
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('EVIDENCE_REQUIRED');
    expect(early.body.details).toEqual({ required: 2, finalized: 1 });
    expect((await flow.get('requester1', `/requests/${id}`)).body.state).toBe('IN_PROGRESS');

    expect((await flow.uploadEvidence(id, tech)).body.finalizedCount).toBe(2);
    const stopped = await flow.stop(id, tech);
    expect(stopped.status).toBe(200);
    expect(stopped.body.state).toBe('UNDER_REVIEW');
    expect(Date.parse(stopped.body.reviewDeadlineAt)).toBeGreaterThan(Date.now());

    const approved = await flow.review(id, { decision: 'APPROVE' });
    expect(approved.status).toBe(200);
    expect(approved.body.state).toBe('COMPLETED');
    expect(approved.body.settlement).toMatchObject({
      amountMinor: approved.body.quoteMinor,
      status: 'SETTLED',
    });
    expect(approved.body.settlement.providerRef).toMatch(/^MOCK-/);

    expect(await ctx.sql(`SELECT 1 FROM settlements WHERE request_id = $1`, [id])).toHaveLength(1);
    const events = await ctx.sql<{ state_to: string }>(
      `SELECT state_to FROM job_events WHERE request_id = $1 ORDER BY seq`,
      [id],
    );
    expect(events.map((e) => e.state_to)).toEqual([
      'CREATED',
      'ASSIGNED',
      'ARRIVED',
      'IN_PROGRESS',
      'UNDER_REVIEW',
      'COMPLETED',
    ]);
    const tech1 = await ctx.sql<{ availability_status: string }>(
      `SELECT availability_status FROM technicians WHERE user_id = $1`,
      [TECH_ID(1)],
    );
    expect(tech1[0]!.availability_status).toBe('AVAILABLE');
    expect(
      await ctx.sql(`SELECT 1 FROM assignments WHERE request_id = $1 AND status = 'COMPLETED'`, [id]),
    ).toHaveLength(1);
    const audit = await ctx.sql<{ action: string }>(`SELECT action FROM audit_logs WHERE request_id = $1`, [
      id,
    ]);
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining([
        'request.create',
        'request.confirm',
        'otp.issue',
        'otp.consumed',
        'request.start',
        'evidence.finalize',
        'request.stop',
        'request.approve',
        'settlement.create',
      ]),
    );
    // State-machine edges the client cannot force
    expect((await flow.start(id, tech)).status).toBe(404); // assignment ended with completion
    expect((await flow.review(id, { decision: 'APPROVE' })).status).toBe(409);
  });

  it('A2 rework: history is preserved and the new cycle needs its own evidence', async () => {
    const { id, tech } = await flow.underReview(4, 'requester2');
    const rework = await flow.review(
      id,
      { decision: 'REQUEST_REWORK', reason: 'Photos are blurry' },
      'requester2',
    );
    expect(rework.status).toBe(200);
    expect(rework.body.state).toBe('REWORK_REQUESTED');

    const restarted = await flow.start(id, tech);
    expect(restarted.body.state).toBe('IN_PROGRESS');
    expect(restarted.body.workCycle).toBe(2);
    const gated = await flow.stop(id, tech);
    expect(gated.body.code).toBe('EVIDENCE_REQUIRED'); // cycle-1 images don't count
    expect(gated.body.details).toEqual({ required: 2, finalized: 0 });

    await flow.twoImages(id, tech);
    expect((await flow.stop(id, tech)).body.state).toBe('UNDER_REVIEW');
    const done = await flow.review(id, { decision: 'APPROVE' }, 'requester2');
    expect(done.body.state).toBe('COMPLETED');

    const media = await ctx.sql<{ work_cycle: number; n: number }>(
      `SELECT work_cycle, count(*)::int AS n FROM evidence_media WHERE request_id = $1 AND status = 'FINALIZED' GROUP BY 1 ORDER BY 1`,
      [id],
    );
    expect(media).toEqual([
      { work_cycle: 1, n: 2 },
      { work_cycle: 2, n: 2 },
    ]);
    const events = await ctx.sql<{ action: string; reason: string | null }>(
      `SELECT action, reason FROM job_events WHERE request_id = $1 ORDER BY seq`,
      [id],
    );
    expect(events.find((e) => e.action === 'REQUEST_REWORK')?.reason).toBe('Photos are blurry');
    expect(events.map((e) => e.action).filter((a) => a === 'STOP')).toHaveLength(2);
    const outbox = await ctx.sql<{ type: string }>(
      `SELECT type FROM outbox_events WHERE request_id = $1 AND type = 'review.requested'`,
      [id],
    );
    expect(outbox).toHaveLength(1);

    const listed = await flow.get('requester2', `/requests/${id}/evidence`);
    expect(listed.body).toHaveLength(4);
  });

  it('rework needs a reason and only the owning requester can review', async () => {
    const { id } = await flow.underReview(2, 'requester1');
    expect((await flow.review(id, { decision: 'REQUEST_REWORK' })).status).toBe(400);
    expect((await flow.review(id, { decision: 'APPROVE', reason: 'x' })).status).toBe(400);
    expect((await flow.review(id, { decision: 'APPROVE' }, 'requester2')).status).toBe(404);
    const asTech = await flow.post('tech2', `/requests/${id}/review`, { decision: 'APPROVE' });
    expect(asTech.status).toBe(403);
    expect((await flow.get('requester1', `/requests/${id}`)).body.state).toBe('UNDER_REVIEW');
  });

  it('cannot skip states', async () => {
    const id = await flow.assigned(3, 'requester3').catch(() => null);
    expect(id).toBeNull(); // technician 3 is mechanical-only; electrical request is correctly refused
    const a = await flow.assigned(4, 'requester3');
    expect((await flow.start(a, 'tech4')).body.code).toBe('ILLEGAL_TRANSITION'); // not arrived
    expect((await flow.stop(a, 'tech4')).body.code).toBe('ILLEGAL_TRANSITION');
    expect((await flow.review(a, { decision: 'APPROVE' }, 'requester3')).body.code).toBe(
      'ILLEGAL_TRANSITION',
    );
    const intent = await flow.post(
      'tech4',
      `/requests/${a}/evidence/intent`,
      {
        contentType: 'image/png',
        sizeBytes: 100,
        checksumSha256: 'a'.repeat(64),
      },
      null,
    );
    expect(intent.status).toBe(409); // evidence only while IN_PROGRESS
  });

  it('requester can cancel before work starts, freeing the technician', async () => {
    const id = await flow.assigned(8, 'requester3');
    const res = await flow.post('requester3', `/requests/${id}/cancel`);
    expect(res.body.state).toBe('CANCELLED');
    const t = await ctx.sql<{ availability_status: string }>(
      `SELECT availability_status FROM technicians WHERE user_id = $1`,
      [TECH_ID(8)],
    );
    expect(t[0]!.availability_status).toBe('AVAILABLE');
    expect((await flow.start(id, 'tech8')).status).toBe(404); // assignment ended
  });

  it('snapshot returns current state plus missed events after a cursor', async () => {
    const id = await flow.assigned(8, 'requester3');
    const snap = await flow.get('requester3', `/requests/${id}/snapshot`);
    expect(snap.status).toBe(200);
    expect(snap.body.request.state).toBe('ASSIGNED');
    const types = snap.body.events.map((e: { type: string }) => e.type);
    expect(types).toEqual(
      expect.arrayContaining(['request.created', 'request.state.changed', 'assignment.created']),
    );
    for (const e of snap.body.events) {
      expect(e).toMatchObject({ schemaVersion: 1 });
      expect(e.eventId).toMatch(/^[0-9a-f-]{36}$/);
    }
    const next = await flow.get('requester3', `/requests/${id}/snapshot?since=${snap.body.cursor}`);
    expect(next.body.events).toEqual([]);
    expect(next.body.request.state).toBe('ASSIGNED');
    expect((await flow.get('requester1', `/requests/${id}/snapshot`)).status).toBe(404);
    expect(ACCOUNTS.admin).toBeTruthy();
  });
});
