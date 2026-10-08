import { TestCtx, createTestApp } from '../support/app';

describe('service landing document and unknown routes', () => {
  let ctx: TestCtx;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  it('GET / answers with a landing document (no data, no auth) instead of a bare 404', async () => {
    const res = await ctx.http().get('/').expect(200);
    expect(res.body).toMatchObject({
      service: 'Field Dispatch API',
      status: 'ok',
      links: { apiBase: '/api/v1', health: '/health/ready' },
    });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(JSON.stringify(res.body)).not.toMatch(/token|secret|password|postgres|redis/i);
  });

  it('unknown paths still return the standard 404 envelope with a correlation id', async () => {
    for (const path of ['/nope', '/api', '/api/v1', '/api/v1/', '/health']) {
      const res = await ctx.http().get(path).expect(404);
      expect(res.body).toMatchObject({ code: 'NOT_FOUND', message: 'Resource not found' });
      expect(res.body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('the landing route is read-only', async () => {
    await ctx.http().post('/').send({}).expect(404);
  });
});
