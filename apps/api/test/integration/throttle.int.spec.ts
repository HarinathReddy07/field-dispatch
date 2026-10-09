import { RedisService } from '../../src/infra/redis.service';
import { ACCOUNTS, DEV_PASSWORD, TestCtx, createTestApp } from '../support/app';

const API = '/api/v1';

describe('rate limiting when its store (Redis) is unavailable', () => {
  let ctx: TestCtx;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  it('login FAILS CLOSED: 503 and no credential check', async () => {
    const hit = jest.spyOn(ctx.app.get(RedisService), 'hit').mockRejectedValue(new Error('redis down'));
    try {
      const res = await ctx
        .http()
        .post(`${API}/auth/login`)
        .send({ email: ACCOUNTS.tech1, password: DEV_PASSWORD });
      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
      expect(res.body.accessToken).toBeUndefined();
    } finally {
      hit.mockRestore();
    }
  });

  it('OTP arrival FAILS CLOSED: 503 before the code is ever compared', async () => {
    const technician = await ctx.login(ACCOUNTS.tech1);
    const hit = jest.spyOn(ctx.app.get(RedisService), 'hit').mockRejectedValue(new Error('redis down'));
    try {
      const res = await ctx
        .http()
        .post(`${API}/requests/00000000-0000-4000-8000-0000000000aa/arrive`)
        .set('Authorization', `Bearer ${technician}`)
        .set('Idempotency-Key', 'fail-closed-0001')
        .send({ otp: '123456' });
      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    } finally {
      hit.mockRestore();
    }
  });

  it('generic routes fail open so a cache outage does not take the whole API down', async () => {
    const requester = await ctx.login(ACCOUNTS.requester1);
    const hit = jest.spyOn(ctx.app.get(RedisService), 'hit').mockRejectedValue(new Error('redis down'));
    try {
      const me = await ctx.http().get(`${API}/auth/me`).set('Authorization', `Bearer ${requester}`);
      expect(me.status).toBe(200);
    } finally {
      hit.mockRestore();
    }
  });
});
