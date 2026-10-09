import type { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import { ACCOUNTS, DEV_PASSWORD, TestCtx, createTestApp } from '../support/app';

const API = '/api/v1';

/** Connects and resolves with the outcome instead of throwing, so both branches can be asserted. */
function handshake(
  url: string,
  token: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; message?: string; socket: Socket }> {
  return new Promise((resolve) => {
    const socket = io(url, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: headers,
    });
    socket.on('connect', () => resolve({ ok: true, socket }));
    socket.on('connect_error', (err) => resolve({ ok: false, message: err.message, socket }));
  });
}

describe('transport: HTTPS/WSS deployable profile vs explicit local-dev flag', () => {
  describe('INSECURE_LOCAL_DEV=false (deployable profile)', () => {
    let ctx: TestCtx;
    let url: string;
    const sockets: Socket[] = [];
    beforeAll(async () => {
      ctx = await createTestApp({
        env: { INSECURE_LOCAL_DEV: 'false', CORS_ORIGINS: 'https://admin.example.test' },
      });
      url = `http://127.0.0.1:${(ctx.app.getHttpServer().address() as AddressInfo).port}`;
    });
    afterAll(async () => {
      sockets.forEach((s) => s.close());
      await ctx.close();
    });

    const login = () =>
      ctx.http().post(`${API}/auth/login`).send({ email: ACCOUNTS.tech1, password: DEV_PASSWORD });

    it('rejects plain-HTTP API requests with 426 and the standard error envelope', async () => {
      const res = await login();
      expect(res.status).toBe(426);
      expect(res.body).toMatchObject({ code: 'HTTPS_REQUIRED' });
      expect(res.body.correlationId).toEqual(expect.any(String));
      expect(res.body.accessToken).toBeUndefined();
    });

    it('accepts the same request when the TLS-terminating proxy marks it https', async () => {
      const res = await login().set('X-Forwarded-Proto', 'https');
      expect(res.status).toBe(200);
      expect(res.headers['strict-transport-security']).toMatch(/max-age=/);
    });

    it('keeps the health probes reachable over plain HTTP for the orchestrator', async () => {
      const res = await ctx.http().get('/health/ready');
      expect(res.status).toBe(200);
    });

    it('rejects a plain WS handshake and accepts WSS (X-Forwarded-Proto: https)', async () => {
      const token = (await login().set('X-Forwarded-Proto', 'https')).body.accessToken as string;
      const plain = await handshake(url, token, {});
      sockets.push(plain.socket);
      expect(plain.ok).toBe(false);
      expect(plain.message).toBe('HTTPS_REQUIRED');

      const secure = await handshake(url, token, { 'X-Forwarded-Proto': 'https' });
      sockets.push(secure.socket);
      expect(secure.ok).toBe(true);
    });
  });

  describe('INSECURE_LOCAL_DEV=true (local development only)', () => {
    let ctx: TestCtx;
    beforeAll(async () => {
      ctx = await createTestApp({ env: { INSECURE_LOCAL_DEV: 'true' } });
    });
    afterAll(() => ctx.close());

    it('serves plain HTTP', async () => {
      const res = await ctx
        .http()
        .post(`${API}/auth/login`)
        .send({ email: ACCOUNTS.tech1, password: DEV_PASSWORD });
      expect(res.status).toBe(200);
    });
  });
});
