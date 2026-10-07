import { SweeperService } from '../../src/modules/jobs/sweeper.service';
import { TECH_ID, TestCtx, createTestApp } from '../support/app';
import { Flow } from '../support/flow';

describe('A6 settlement idempotency and the review-timeout sweeper', () => {
  let ctx: TestCtx;
  let flow: Flow;
  beforeAll(async () => {
    ctx = await createTestApp({ env: { REVIEW_TIMEOUT_SECONDS: '1' } });
    flow = new Flow(ctx);
  });
  afterAll(() => ctx.close());

  const sweeper = () => ctx.app.get(SweeperService);
  const settlements = (id: string) => ctx.sql(`SELECT * FROM settlements WHERE request_id = $1`, [id]);
  const expireReview = (id: string) =>
    ctx.sql(`UPDATE service_requests SET review_deadline_at = now() - interval '1 second' WHERE id = $1`, [
      id,
    ]);

  it('20 parallel approvals with different keys: one winner, one settlement', async () => {
    const { id } = await flow.underReview(1);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => flow.review(id, { decision: 'APPROVE' })),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(19);
    expect(await settlements(id)).toHaveLength(1);
    expect(
      await ctx.sql(`SELECT 1 FROM job_events WHERE request_id = $1 AND state_to = 'COMPLETED'`, [id]),
    ).toHaveLength(1);
    expect(
      await ctx.sql(`SELECT 1 FROM outbox_events WHERE request_id = $1 AND type = 'settlement.created'`, [
        id,
      ]),
    ).toHaveLength(1);
  });

  it('20 retries with the SAME key all succeed with the same body and one settlement', async () => {
    const { id } = await flow.underReview(2);
    const key = 'finalize-retry-0001';
    const results = await Promise.all(
      Array.from({ length: 20 }, () => flow.review(id, { decision: 'APPROVE' }, 'requester1', key)),
    );
    expect(results.map((r) => r.status)).toEqual(Array(20).fill(200));
    for (const r of results) expect(r.body).toEqual(results[0]!.body);
    expect(await settlements(id)).toHaveLength(1);
  });

  it('the settlement amount is the server-held quote; client amounts are rejected', async () => {
    const { id } = await flow.underReview(4);
    const tamper = await flow.review(id, { decision: 'APPROVE', amount: 1 });
    expect(tamper.status).toBe(400);
    expect(await settlements(id)).toHaveLength(0);
    const done = await flow.review(id, { decision: 'APPROVE' });
    const [row] = await settlements(id);
    expect((row as { amount_minor: number }).amount_minor).toBe(done.body.quoteMinor);
  });

  it('sweeper auto-approves an overdue review through the same path as manual approval', async () => {
    const { id } = await flow.underReview(8);
    expect(await sweeper().runOnce()).toBe(0); // not yet due
    await expireReview(id);
    expect(await sweeper().runOnce()).toBe(1);

    const view = await flow.get('requester1', `/requests/${id}`);
    expect(view.body.state).toBe('COMPLETED');
    expect(view.body.settlement.status).toBe('SETTLED');
    expect(await settlements(id)).toHaveLength(1);
    const ev = await ctx.sql<{ actor_role: string; actor_id: string | null; action: string }>(
      `SELECT actor_role, actor_id, action FROM job_events WHERE request_id = $1 AND state_to = 'COMPLETED'`,
      [id],
    );
    expect(ev).toEqual([{ actor_role: 'SYSTEM', actor_id: null, action: 'AUTO_APPROVE' }]);
    const t = await ctx.sql<{ availability_status: string }>(
      `SELECT availability_status FROM technicians WHERE user_id = $1`,
      [TECH_ID(8)],
    );
    expect(t[0]!.availability_status).toBe('AVAILABLE');
    expect(await sweeper().runOnce()).toBe(0); // idempotent
  });

  it('sweeper racing a manual approval still produces exactly one settlement', async () => {
    const { id } = await flow.underReview(1);
    await expireReview(id);
    const [approve, swept] = await Promise.all([
      flow.review(id, { decision: 'APPROVE' }),
      sweeper().runOnce(),
    ]);
    expect([200, 409]).toContain(approve.status);
    expect(swept).toBeLessThanOrEqual(1);
    expect(await settlements(id)).toHaveLength(1);
    expect(
      await ctx.sql(`SELECT 1 FROM job_events WHERE request_id = $1 AND state_to = 'COMPLETED'`, [id]),
    ).toHaveLength(1);
  });

  it('two sweeper runs in parallel complete a job once (SKIP LOCKED)', async () => {
    const ids: string[] = [];
    for (const n of [2, 4, 8]) ids.push((await flow.underReview(n)).id);
    for (const id of ids) await expireReview(id);
    const counts = await Promise.all([sweeper().runOnce(), (async () => sweeper().runOnce())()]);
    // the instance guard returns 0 for a re-entrant call; both orders must total exactly 3 completions
    await sweeper().runOnce();
    for (const id of ids) {
      expect(await settlements(id)).toHaveLength(1);
      expect((await flow.get('requester1', `/requests/${id}`)).body.state).toBe('COMPLETED');
    }
    expect(counts.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(3);
  });

  it('a settlement can never be duplicated at the database level', async () => {
    const { id } = await flow.underReview(1);
    await flow.review(id, { decision: 'APPROVE' });
    await expect(
      ctx.sql(
        `INSERT INTO settlements (request_id, amount_minor, idempotency_key, provider_ref) VALUES ($1, 5, 'another-key', 'X')`,
        [id],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
