import { PrismaService } from '../../src/infra/prisma.service';
import { TransitionService } from '../../src/infra/transition.service';
import { REQUESTER_ID, TestCtx, createTestApp } from '../support/app';
import { Flow } from '../support/flow';

/**
 * Spec 4.2 / 7.2: every accepted transition writes the state change, a job_event, an audit entry and the outbox event
 * in ONE transaction; an illegal or rolled-back transition leaves no trace.
 */
describe('state transitions are atomic with their job_event and audit entry', () => {
  let ctx: TestCtx;
  let flow: Flow;
  let transitions: TransitionService;
  let prisma: PrismaService;
  const requester = { id: REQUESTER_ID(1), role: 'REQUESTER' as const };

  beforeAll(async () => {
    ctx = await createTestApp();
    flow = new Flow(ctx);
    transitions = ctx.app.get(TransitionService);
    prisma = ctx.app.get(PrismaService);
  });
  afterAll(async () => {
    await flow.cleanup();
    await ctx.close();
  });

  const snapshot = async (id: string) => {
    const [req] = await ctx.sql<{ state: string; version: number }>(
      `SELECT state, version FROM service_requests WHERE id = $1`,
      [id],
    );
    const count = async (table: string, col = 'request_id') =>
      (await ctx.sql<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${col} = $1`, [id]))[0]!.n;
    return {
      state: req!.state,
      version: req!.version,
      events: await count('job_events'),
      audits: await count('audit_logs'),
      outbox: await count('outbox_events'),
    };
  };

  it('an accepted transition writes the state, job_event, audit entry and outbox event together', async () => {
    const id = await flow.create('requester1');
    const before = await snapshot(id);
    expect(before.state).toBe('REQUESTED');

    await prisma.tx((tx) => transitions.apply(tx, { requestId: id, action: 'SEARCH', actor: requester }));

    const after = await snapshot(id);
    expect(after.state).toBe('MATCHED');
    expect(after.version).toBe(before.version + 1);
    expect(after.events).toBe(before.events + 1);
    expect(after.audits).toBe(before.audits + 1);
    expect(after.outbox).toBe(before.outbox + 1);

    const [event] = await ctx.sql<{
      state_from: string;
      state_to: string;
      actor_id: string;
      occurred_at: Date;
    }>(
      `SELECT state_from, state_to, actor_id, occurred_at FROM job_events WHERE request_id = $1 AND action = 'SEARCH'`,
      [id],
    );
    expect(event).toMatchObject({ state_from: 'REQUESTED', state_to: 'MATCHED', actor_id: requester.id });
    const [audit] = await ctx.sql<{
      actor_id: string;
      action: string;
      metadata: { from: string; to: string };
    }>(
      `SELECT actor_id, action, metadata FROM audit_logs WHERE request_id = $1 AND action = 'request.search'`,
      [id],
    );
    expect(audit).toMatchObject({ actor_id: requester.id, action: 'request.search' });
    expect(audit!.metadata).toMatchObject({ from: 'REQUESTED', to: 'MATCHED' });
  });

  it('if anything after the transition fails, the state, job_event, audit entry and outbox event all roll back', async () => {
    const id = await flow.create('requester1');
    const before = await snapshot(id);

    await expect(
      prisma.tx(async (tx) => {
        await transitions.apply(tx, { requestId: id, action: 'SEARCH', actor: requester });
        throw new Error('simulated failure after the transition was written');
      }),
    ).rejects.toThrow('simulated failure');

    expect(await snapshot(id)).toEqual(before);
  });

  it('an illegal transition is rejected and writes nothing', async () => {
    const id = await flow.create('requester1');
    const before = await snapshot(id);

    await expect(
      prisma.tx((tx) => transitions.apply(tx, { requestId: id, action: 'SETTLE', actor: requester })),
    ).rejects.toMatchObject({ code: expect.stringMatching(/ILLEGAL_TRANSITION|FORBIDDEN/) });
    await expect(
      prisma.tx((tx) =>
        transitions.apply(tx, { requestId: id, action: 'APPROVE', actor: { id: null, role: 'SYSTEM' } }),
      ),
    ).rejects.toBeDefined();

    expect(await snapshot(id)).toEqual(before);
  });

  it('a client cannot push a request to COMPLETED/SETTLED through any route while evidence is missing', async () => {
    const job = await flow.inProgress(1, 'requester1');
    const before = await snapshot(job.id);
    const stop = await flow.stop(job.id, job.tech); // no evidence uploaded
    expect(stop.status).toBe(409);
    const review = await flow.post('requester1', `/requests/${job.id}/review`, { decision: 'APPROVE' });
    expect(review.status).toBe(409);
    const forged = await flow.post('requester1', `/requests/${job.id}/review`, {
      decision: 'APPROVE',
      state: 'COMPLETED',
    });
    expect(forged.status).toBe(400); // unknown field
    expect(await snapshot(job.id)).toEqual(before);
  });
});
