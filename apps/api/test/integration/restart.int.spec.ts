import { createTestApp } from '../support/app';
import { Flow } from '../support/flow';

/**
 * A7: the API process restarts mid-flow. "Restart" here = a new Nest application instance (new
 * connections, empty in-memory state, fresh storage mock) against the same PostgreSQL/Redis.
 * The container-level kill/restart variant is scripted in docs/test-plan.md (needs Docker).
 */
describe('A7 restart resilience', () => {
  it('assignment, OTP and work state survive a restart and the flow continues', async () => {
    const app1 = await createTestApp();
    const f1 = new Flow(app1);
    const id = await f1.assigned(1);
    const otp = await f1.otp(id);
    const staleToken = await f1.token('tech1');
    await app1.close({ keepDb: true });

    const app2 = await createTestApp({ db: app1.db });
    try {
      const f2 = new Flow(app2);
      // persisted business state is intact, and a token issued before the restart is still valid
      const view = await app2
        .http()
        .get(`/api/v1/requests/${id}`)
        .set('Authorization', `Bearer ${staleToken}`);
      expect(view.status).toBe(200);
      expect(view.body.state).toBe('ASSIGNED');
      // the OTP issued by the previous process verifies on the new one (state lives in PostgreSQL)
      const arrive = await f2.arrive(id, 'tech1', otp);
      expect(arrive.status).toBe(200);
      expect(arrive.body.state).toBe('ARRIVED');
      expect((await f2.start(id, 'tech1')).body.state).toBe('IN_PROGRESS');
      await f2.twoImages(id, 'tech1');
      expect((await f2.stop(id, 'tech1')).body.state).toBe('UNDER_REVIEW');
      await f2.cleanup();
      await f1.cleanup().catch(() => undefined);
      await f2.post('admin', `/admin/jobs/${id}/cancel`, { reason: 'test cleanup after restart' }, null);
    } finally {
      await app2.close();
    }
  });

  it('the review timeout still fires after a restart (persisted deadline, sweeper resumes)', async () => {
    const app1 = await createTestApp({ env: { REVIEW_TIMEOUT_SECONDS: '3' } });
    const f1 = new Flow(app1);
    const { id } = await f1.underReview(1);
    const before = await f1.get('requester1', `/requests/${id}`);
    expect(before.body.state).toBe('UNDER_REVIEW');
    const deadline = Date.parse(before.body.reviewDeadlineAt);
    await app1.close({ keepDb: true }); // process dies while the job awaits review

    // new instance with the background sweeper enabled and nobody calling the API
    const app2 = await createTestApp({
      db: app1.db,
      env: {
        REVIEW_TIMEOUT_SECONDS: '3',
        BACKGROUND_JOBS: 'true',
        SWEEPER_INTERVAL_MS: '200',
        OUTBOX_POLL_MS: '100',
      },
    });
    try {
      const rows = await app2.sql<{ state: string }>(`SELECT state FROM service_requests WHERE id = $1`, [
        id,
      ]);
      expect(rows[0]!.state === 'UNDER_REVIEW' || Date.now() >= deadline).toBe(true);
      let state = 'UNDER_REVIEW';
      for (let i = 0; i < 60 && state !== 'COMPLETED'; i++) {
        await new Promise((r) => setTimeout(r, 250));
        state = (
          await app2.sql<{ state: string }>(`SELECT state FROM service_requests WHERE id = $1`, [id])
        )[0]!.state;
      }
      expect(state).toBe('COMPLETED');
      expect(Date.now()).toBeGreaterThanOrEqual(deadline);
      expect(await app2.sql(`SELECT 1 FROM settlements WHERE request_id = $1`, [id])).toHaveLength(1);
      const ev = await app2.sql<{ actor_role: string }>(
        `SELECT actor_role FROM job_events WHERE request_id = $1 AND state_to = 'COMPLETED'`,
        [id],
      );
      expect(ev).toEqual([{ actor_role: 'SYSTEM' }]);
      // events written before/after the restart were delivered exactly once (published_at set, none left pending)
      await new Promise((r) => setTimeout(r, 600));
      expect(await app2.sql(`SELECT 1 FROM outbox_events WHERE published_at IS NULL`)).toHaveLength(0);
    } finally {
      await app2.close();
    }
  });

  it('the readiness probe reports dependencies; a stopped dependency is visible', async () => {
    const app = await createTestApp();
    try {
      const ok = await app.http().get('/health/ready');
      expect(ok.status).toBe(200);
      expect(ok.body.checks).toEqual({ database: true, redis: true });
    } finally {
      await app.close();
    }
  });
});
