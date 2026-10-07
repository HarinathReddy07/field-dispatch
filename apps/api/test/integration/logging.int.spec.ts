import { Writable } from 'node:stream';
import { ACCOUNTS, DEV_PASSWORD, TestCtx, createTestApp } from '../support/app';
import { Flow } from '../support/flow';

describe('sensitive logging', () => {
  const lines: string[] = [];
  let ctx: TestCtx;
  let flow: Flow;

  beforeAll(async () => {
    const stream = new Writable({
      write(chunk, _enc, cb) {
        lines.push(String(chunk));
        cb();
      },
    });
    ctx = await createTestApp({ logStream: stream, logLevel: 'info' });
    flow = new Flow(ctx);
  });
  afterAll(() => ctx.close());

  it('logs requests with correlation ids but never passwords, OTPs, tokens or auth headers', async () => {
    const wrongPassword = 'Sup3r-Secret-Wrong-Pass!';
    await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email: ACCOUNTS.requester1, password: wrongPassword })
      .expect(401);
    const login = await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email: ACCOUNTS.requester1, password: DEV_PASSWORD })
      .expect(200);
    const { accessToken, refreshToken } = login.body as { accessToken: string; refreshToken: string };

    const id = await flow.assigned(1);
    const otp = await flow.otp(id);
    const wrongOtp = otp === '123456' ? '654321' : '123456';
    await flow.arrive(id, 'tech1', wrongOtp);
    await flow.arrive(id, 'tech1', otp);
    await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken }).expect(200);
    await ctx
      .http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-correlation-id', 'log-check-0001')
      .expect(200);
    await ctx
      .http()
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ bad: 'payload', password: wrongPassword })
      .expect(400);

    await new Promise((r) => setTimeout(r, 100));
    const all = lines.join('');
    expect(all.length).toBeGreaterThan(0); // logging actually happened
    expect(all).toContain('log-check-0001'); // correlation id is logged
    for (const secret of [
      wrongPassword,
      DEV_PASSWORD,
      otp,
      wrongOtp,
      accessToken,
      refreshToken,
      'Bearer ',
      'authorization',
    ]) {
      expect(all.toLowerCase()).not.toContain(secret.toLowerCase());
    }
    expect(all).not.toMatch(/"otp"\s*:\s*"\d{6}"/);
    expect(all).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./); // no JWTs
    // no request bodies or query strings at all
    expect(all).not.toContain('"body"');
  });
});
