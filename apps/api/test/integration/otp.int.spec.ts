import { TestCtx, createTestApp } from '../support/app';
import { Flow } from '../support/flow';

describe('A3 arrival OTP security', () => {
  let ctx: TestCtx;
  let flow: Flow;
  beforeAll(async () => {
    ctx = await createTestApp({ env: { OTP_MAX_ATTEMPTS: '5', OTP_LOCK_SECONDS: '300' } });
    flow = new Flow(ctx);
  });
  afterEach(() => flow.cleanup());
  afterAll(() => ctx.close());

  const wrongOtp = (otp: string) => (otp === '000000' ? '111111' : '000000');

  it('wrong, expired and superseded codes fail with one uniform error; a valid code works once', async () => {
    const id = await flow.assigned(1);
    const otp = await flow.otp(id);

    const wrong = await flow.arrive(id, 'tech1', wrongOtp(otp));
    expect(wrong.status).toBe(400);
    expect(wrong.body).toMatchObject({ code: 'OTP_INVALID', message: 'Invalid or expired code' });

    // expire the code (fixture time travel) -> still the same uniform error, even with the right digits
    await ctx.sql(
      `UPDATE otp_challenges SET expires_at = now() - interval '1 second' WHERE request_id = $1 AND consumed_at IS NULL`,
      [id],
    );
    const expired = await flow.arrive(id, 'tech1', otp);
    expect(expired.status).toBe(400);
    expect(expired.body.message).toBe(wrong.body.message);

    // a re-issued code supersedes the previous one
    const first = await flow.otp(id);
    const second = await flow.otp(id);
    const superseded = first === second ? null : await flow.arrive(id, 'tech1', first);
    if (superseded) expect(superseded.body.code).toBe('OTP_INVALID');

    const ok = await flow.arrive(id, 'tech1', second);
    expect(ok.status).toBe(200);
    expect(ok.body.state).toBe('ARRIVED');

    // replay of the consumed code cannot arrive again
    const replay = await flow.arrive(id, 'tech1', second);
    expect(replay.status).toBe(409);
    expect(replay.body.code).toBe('ILLEGAL_TRANSITION');
    const consumed = await ctx.sql<{ consumed_at: Date | null }>(
      `SELECT consumed_at FROM otp_challenges WHERE request_id = $1 AND consumed_at IS NOT NULL`,
      [id],
    );
    expect(consumed).toHaveLength(1);
  });

  it('only the hash is stored: the plain code is never persisted or audited', async () => {
    const id = await flow.assigned(2);
    const otp = await flow.otp(id);
    const rows = await ctx.sql<{ otp_hmac: string }>(
      `SELECT otp_hmac FROM otp_challenges WHERE request_id = $1`,
      [id],
    );
    expect(rows[0]!.otp_hmac).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0]!.otp_hmac).not.toContain(otp);
    await flow.arrive(id, 'tech2', wrongOtp(otp));
    const dump = JSON.stringify([
      await ctx.sql(`SELECT * FROM audit_logs WHERE request_id = $1`, [id]),
      await ctx.sql(`SELECT * FROM job_events WHERE request_id = $1`, [id]),
      await ctx.sql(`SELECT * FROM idempotency_keys`),
      await ctx.sql(`SELECT * FROM outbox_events WHERE request_id = $1`, [id]),
    ]);
    expect(dump).not.toContain(`"${otp}"`);
    expect(dump).not.toMatch(new RegExp(`otp"?:\\s*"${otp}"`));
  });

  it('brute force: attempts are counted, the code locks, and the lock blocks even the correct code', async () => {
    const id = await flow.assigned(4);
    const otp = await flow.otp(id);
    const bad = wrongOtp(otp);
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await flow.arrive(id, 'tech4', bad)).status);
    expect(statuses).toEqual([400, 400, 400, 400, 400]);

    const locked = await flow.arrive(id, 'tech4', otp); // correct code, but locked
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('OTP_LOCKED');
    expect((await flow.get('requester1', `/requests/${id}`)).body.state).toBe('CONFIRMED');
    const audit = await ctx.sql<{ action: string }>(
      `SELECT action FROM audit_logs WHERE request_id = $1 AND action LIKE 'otp.%' ORDER BY seq`,
      [id],
    );
    expect(audit.map((a) => a.action)).toEqual([
      'otp.issue',
      'otp.failed',
      'otp.failed',
      'otp.failed',
      'otp.failed',
      'otp.locked',
    ]);

    // lock expiry restores a fresh attempt budget
    await ctx.sql(
      `UPDATE otp_challenges SET locked_until = now() - interval '1 second' WHERE request_id = $1`,
      [id],
    );
    expect((await flow.arrive(id, 'tech4', otp)).status).toBe(200);
  });

  it('10 parallel verifications of a valid code produce exactly one ARRIVED transition', async () => {
    const id = await flow.assigned(8);
    const otp = await flow.otp(id);
    const results = await Promise.all(Array.from({ length: 10 }, () => flow.arrive(id, 'tech8', otp)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(9);
    expect(
      await ctx.sql(`SELECT 1 FROM job_events WHERE request_id = $1 AND action = 'ARRIVE'`, [id]),
    ).toHaveLength(1);
    expect(
      await ctx.sql(`SELECT 1 FROM otp_challenges WHERE request_id = $1 AND consumed_at IS NOT NULL`, [id]),
    ).toHaveLength(1);
  });

  it('concurrent wrong guesses are all counted (no lost updates) and lock the code', async () => {
    const id = await flow.assigned(1);
    const otp = await flow.otp(id);
    const bad = wrongOtp(otp);
    const results = await Promise.all(Array.from({ length: 12 }, () => flow.arrive(id, 'tech1', bad)));
    const codes = results.map((r) => r.body.code);
    expect(codes.filter((c) => c === 'OTP_INVALID')).toHaveLength(5); // exactly the attempt budget
    expect(codes.filter((c) => c === 'OTP_LOCKED')).toHaveLength(7);
    expect((await flow.arrive(id, 'tech1', otp)).body.code).toBe('OTP_LOCKED');
  });

  it('only the assigned technician can submit; only the owning requester can issue', async () => {
    const id = await flow.assigned(2, 'requester2');
    const otp = await flow.otp(id, 'requester2');
    expect((await flow.arrive(id, 'tech4', otp)).status).toBe(404); // another technician
    expect((await flow.post('requester2', `/requests/${id}/arrive`, { otp })).status).toBe(403); // wrong role
    expect((await flow.post('requester1', `/requests/${id}/otp`, {}, null)).status).toBe(404); // another requester
    expect((await flow.post('tech2', `/requests/${id}/otp`, {}, null)).status).toBe(403);
    expect((await flow.post('tech2', `/requests/${id}/arrive`, { otp: '12345' })).status).toBe(400); // malformed
    expect((await flow.post('tech2', `/requests/${id}/arrive`, { otp, extra: 1 })).status).toBe(400); // unknown key
    expect((await flow.arrive(id, 'tech2', otp)).status).toBe(200);
  });

  it('arrive is idempotent for a retried request (same key replays, no double transition)', async () => {
    const id = await flow.assigned(1);
    const otp = await flow.otp(id);
    const key = 'retry-key-0001';
    const a = await flow.arrive(id, 'tech1', otp, key);
    const b = await flow.arrive(id, 'tech1', otp, key);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(b.body).toEqual(a.body);
    expect((await flow.arrive(id, 'tech1', wrongOtp(otp), key)).body.code).toBe('IDEMPOTENCY_MISMATCH');
    expect(
      await ctx.sql(`SELECT 1 FROM job_events WHERE request_id = $1 AND action = 'ARRIVE'`, [id]),
    ).toHaveLength(1);
  });
});
