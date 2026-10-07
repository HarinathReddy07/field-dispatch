import type { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import { EventEnvelope, SOCKET_EVENTS } from '@dispatch/contracts';
import { RealtimeGateway } from '../../src/modules/realtime/realtime.gateway';
import { TECH_ID, TestCtx, createTestApp } from '../support/app';
import { Flow, Who } from '../support/flow';

interface Client {
  socket: Socket;
  events: EventEnvelope[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond: () => boolean, ms = 5000, what = 'condition'): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error(`timed out waiting for ${what}`);
    await sleep(20);
  }
}

describe('realtime (Socket.io)', () => {
  let ctx: TestCtx;
  let flow: Flow;
  let url: string;
  const open: Socket[] = [];

  beforeAll(async () => {
    ctx = await createTestApp({
      env: { BACKGROUND_JOBS: 'true', OUTBOX_POLL_MS: '50', SWEEPER_INTERVAL_MS: '60000' },
    });
    flow = new Flow(ctx);
    url = `http://127.0.0.1:${(ctx.app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterEach(async () => {
    await flow.cleanup();
  });
  afterAll(async () => {
    open.forEach((s) => s.close());
    await ctx.close();
  });

  async function connect(who: Who): Promise<Client> {
    const socket = io(url, {
      auth: { token: await flow.token(who) },
      transports: ['websocket'],
      reconnection: false,
    });
    open.push(socket);
    const events: EventEnvelope[] = [];
    for (const t of SOCKET_EVENTS) socket.on(t, (e: EventEnvelope) => events.push(e));
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', (e) => reject(e));
    });
    return { socket, events };
  }
  const types = (c: Client, requestId: string) =>
    c.events.filter((e) => e.requestId === requestId).map((e) => e.type);
  const ack = (c: Client, event: string, body: unknown) =>
    c.socket.timeout(3000).emitWithAck(event, body) as Promise<{ ok: boolean; code?: string }>;

  it('rejects connections without a valid access token', async () => {
    for (const auth of [{}, { token: 'garbage' }, { token: 123 }]) {
      const s = io(url, { auth, transports: ['websocket'], reconnection: false });
      open.push(s);
      const err = await new Promise<Error>((resolve) => s.once('connect_error', resolve));
      expect(err.message).toBe('UNAUTHENTICATED');
      s.close();
    }
  });

  it('delivers events only to the right rooms, after commit, with the standard envelope', async () => {
    const [r1, r2, t1, t2, admin] = await Promise.all(
      (['requester1', 'requester2', 'tech1', 'tech2', 'admin'] as Who[]).map(connect),
    );
    const id = await flow.assigned(1, 'requester1');

    await waitFor(() => types(t1!, id).includes('assignment.created'), 5000, 'technician assignment event');
    await waitFor(() => types(admin!, id).includes('assignment.created'), 5000, 'admin assignment event');
    await waitFor(() => types(r1!, id).includes('assignment.created'), 5000, 'requester assignment event');
    await sleep(300);

    expect(types(admin!, id)).toEqual(
      expect.arrayContaining(['request.created', 'request.state.changed', 'assignment.created']),
    );
    expect(types(r1!, id)).toEqual(expect.arrayContaining(['request.created', 'assignment.created']));
    expect(types(t1!, id)).toEqual(expect.arrayContaining(['request.state.changed', 'assignment.created']));
    expect(types(t1!, id)).not.toContain('request.created'); // admin/requester only
    // isolation: uninvolved users receive nothing about this job
    expect(types(t2!, id)).toEqual([]);
    expect(types(r2!, id)).toEqual([]);

    const e = admin!.events.find((x) => x.type === 'assignment.created' && x.requestId === id)!;
    expect(e).toMatchObject({ schemaVersion: 1, requestId: id, data: { technicianId: TECH_ID(1) } });
    expect(e.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(e.occurredAt)).not.toBeNaN();
    expect(e.seq).toBeGreaterThan(0);
    // delivered rows are marked published exactly once
    expect(
      await ctx.sql(`SELECT 1 FROM outbox_events WHERE request_id = $1 AND published_at IS NULL`, [id]),
    ).toHaveLength(0);
    [r1, r2, t1, t2, admin].forEach((c) => c!.socket.close());
  });

  it('losing concurrent confirms emit nothing (events only follow a committed transaction)', async () => {
    const admin = await connect('admin');
    const id = await flow.create('requester1');
    const results = await Promise.all(Array.from({ length: 6 }, () => flow.confirm(id, 1, 'requester1')));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    await waitFor(() => types(admin, id).includes('assignment.created'), 5000, 'winner event');
    await sleep(400);
    expect(admin.events.filter((e) => e.requestId === id && e.type === 'assignment.created')).toHaveLength(1);
    expect(
      admin.events.filter(
        (e) =>
          e.requestId === id &&
          e.type === 'request.state.changed' &&
          (e.data as { to?: string }).to === 'ASSIGNED',
      ),
    ).toHaveLength(1);
    admin.socket.close();
  });

  it('streams the whole lifecycle to the right audiences (evidence, rework, settlement)', async () => {
    const [r1, t1, t2, admin] = await Promise.all(
      (['requester1', 'tech1', 'tech2', 'admin'] as Who[]).map(connect),
    );
    const { id, tech } = await flow.inProgress(1, 'requester1');
    await flow.twoImages(id, tech);
    await flow.stop(id, tech);
    await flow.review(id, { decision: 'REQUEST_REWORK', reason: 'Need clearer photos' });
    await waitFor(() => types(t1!, id).includes('review.requested'), 5000, 'review.requested to technician');
    await flow.start(id, tech);
    await flow.twoImages(id, tech);
    await flow.stop(id, tech);
    await flow.review(id, { decision: 'APPROVE' });
    await waitFor(
      () => types(r1!, id).includes('settlement.created'),
      5000,
      'settlement.created to requester',
    );
    await waitFor(
      () => types(admin!, id).includes('settlement.created'),
      5000,
      'settlement.created to admin',
    );
    await sleep(300);

    expect(types(r1!, id)).toEqual(expect.arrayContaining(['evidence.uploaded', 'settlement.created']));
    expect(types(admin!, id)).toEqual(
      expect.arrayContaining(['evidence.uploaded', 'review.requested', 'settlement.created']),
    );
    expect(types(t1!, id)).toContain('review.requested');
    expect(types(t1!, id)).not.toContain('evidence.uploaded'); // requester/admin only
    expect(types(t1!, id)).not.toContain('settlement.created');
    expect(types(t2!, id)).toEqual([]);
    const seqs = admin!.events.filter((e) => e.requestId === id).map((e) => e.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs); // ordered by seq
    expect(new Set(admin!.events.map((e) => e.eventId)).size).toBe(admin!.events.length); // unique ids
    const states = admin!.events
      .filter((e) => e.requestId === id && e.type === 'request.state.changed')
      .map((e) => (e.data as { to: string }).to);
    expect(states).toEqual([
      'ASSIGNED',
      'ARRIVED',
      'IN_PROGRESS',
      'UNDER_REVIEW',
      'REWORK_REQUESTED',
      'IN_PROGRESS',
      'UNDER_REVIEW',
      'COMPLETED',
    ]);
    [r1, t1, t2, admin].forEach((c) => c!.socket.close());
  });

  it('room joins are authorized server-side; location samples reach only authorized viewers', async () => {
    const [r1, r2, t1, t2, admin] = await Promise.all(
      (['requester1', 'requester2', 'tech1', 'tech2', 'admin'] as Who[]).map(connect),
    );
    const id = await flow.assigned(1, 'requester1');

    expect(await ack(t2!, 'request.subscribe', { requestId: id })).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(await ack(r2!, 'request.subscribe', { requestId: id })).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(await ack(r1!, 'request.subscribe', { requestId: 'not-a-uuid' })).toEqual({
      ok: false,
      code: 'VALIDATION_FAILED',
    });
    expect(await ack(r1!, 'request.subscribe', { requestId: id, extra: 1 })).toEqual({
      ok: false,
      code: 'VALIDATION_FAILED',
    });
    expect(await ack(r1!, 'request.subscribe', { requestId: id })).toEqual({ ok: true });
    expect(await ack(t1!, 'request.subscribe', { requestId: id })).toEqual({ ok: true });

    const ping = await flow.post('tech1', '/technicians/me/location', { lat: 12.9751, lon: 77.6071 }, null);
    expect(ping.status).toBe(202);
    await waitFor(
      () => types(r1!, id).includes('technician.location.updated'),
      5000,
      'location to requester',
    );
    await waitFor(() => types(admin!, id).includes('technician.location.updated'), 5000, 'location to admin');
    await sleep(300);
    const loc = r1!.events.find((e) => e.type === 'technician.location.updated')!;
    expect(loc.data).toMatchObject({ technicianId: TECH_ID(1), lat: 12.9751, lon: 77.6071 });
    expect(types(r2!, id)).toEqual([]);
    expect(types(t2!, id)).toEqual([]);

    // a technician with NO active job produces no live event at all
    const idle = await flow.post('tech4', '/technicians/me/location', { lat: 12.92, lon: 77.59 }, null);
    expect(idle.status).toBe(202);
    await sleep(300);
    expect(r1!.events.filter((e) => e.type === 'technician.location.updated')).toHaveLength(1);
    [r1, r2, t1, t2, admin].forEach((c) => c!.socket.close());
  });

  it('reconnect resync: a snapshot with the last seen cursor returns exactly the missed events', async () => {
    const r1 = await connect('requester1');
    const id = await flow.assigned(1, 'requester1');
    await waitFor(() => types(r1, id).includes('assignment.created'), 5000, 'initial events');
    await sleep(200);
    const lastSeq = Math.max(...r1.events.filter((e) => e.requestId === id).map((e) => e.seq));
    r1.socket.close(); // connection lost

    const otp = await flow.otp(id, 'requester1');
    await flow.arrive(id, 'tech1', otp);
    await flow.start(id, 'tech1');

    const snap = await flow.get('requester1', `/requests/${id}/snapshot?since=${lastSeq}`);
    expect(snap.body.request.state).toBe('IN_PROGRESS');
    const missed = snap.body.events as EventEnvelope[];
    expect(missed.map((e) => (e.data as { to?: string }).to)).toEqual(['ARRIVED', 'IN_PROGRESS']);
    expect(missed.every((e) => e.seq > lastSeq)).toBe(true);

    for (
      let i = 0;
      i < 100 &&
      (await ctx.sql(`SELECT 1 FROM outbox_events WHERE request_id = $1 AND published_at IS NULL`, [id]))
        .length > 0;
      i++
    )
      await sleep(50); // outbox drained while offline
    const again = await connect('requester1'); // reconnect: no replay over the socket, REST is the source of truth
    await sleep(300);
    expect(again.events.filter((e) => e.requestId === id)).toEqual([]);
    const caught = await flow.get('requester1', `/requests/${id}/snapshot?since=${snap.body.cursor}`);
    expect(caught.body.events).toEqual([]);
    again.socket.close();
  });

  it('a reassigned technician is removed from the live request room', async () => {
    const t1 = await connect('tech1');
    const id = await flow.assigned(1, 'requester1');
    expect(await ack(t1, 'request.subscribe', { requestId: id })).toEqual({ ok: true });
    const gateway = ctx.app.get(RealtimeGateway);
    const members = async () =>
      (await gateway.server.in(`request:${id}`).fetchSockets()).map(
        (s) => (s.data as { user: { id: string } }).user.id,
      );
    expect(await members()).toContain(TECH_ID(1));

    const res = await flow.post(
      'admin',
      `/admin/jobs/${id}/reassign`,
      { technicianId: TECH_ID(2), reason: 'Technician unavailable' },
      null,
    );
    expect(res.status).toBe(200);
    await waitFor(
      () => t1.events.some((e) => e.type === 'admin.override'),
      5000,
      'admin.override to old technician',
    );
    for (let i = 0; i < 50 && (await members()).includes(TECH_ID(1)); i++) await sleep(50);
    expect(await members()).not.toContain(TECH_ID(1));
    t1.socket.close();
  });

  it('disconnects sockets when the access token expires', async () => {
    const short = await createTestApp({ env: { ACCESS_TOKEN_TTL_SECONDS: '2', BACKGROUND_JOBS: 'true' } });
    try {
      const f = new Flow(short);
      const u = `http://127.0.0.1:${(short.app.getHttpServer().address() as AddressInfo).port}`;
      const socket = io(u, {
        auth: { token: await f.token('requester1') },
        transports: ['websocket'],
        reconnection: false,
      });
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', reject);
      });
      const reason = await new Promise<string>((resolve) => socket.once('disconnect', resolve));
      expect(reason).toBe('io server disconnect');
    } finally {
      await short.close();
    }
  });
});
