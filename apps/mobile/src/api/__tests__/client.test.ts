import { ApiClient, ApiError, type Tokens, type TokenStore } from '../client';

function memoryStore(initial: Tokens | null = null): TokenStore & { current: Tokens | null } {
  const s = {
    current: initial,
    async get() {
      return s.current;
    },
    async set(t: Tokens | null) {
      s.current = t;
    },
  };
  return s;
}

const tokens = (over: Partial<Tokens> = {}): Tokens => ({
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAtMs: Date.now() + 600_000,
  ...over,
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function setup(
  handler: (req: { url: string; init: RequestInit; call: number }) => Response | Promise<Response>,
  initial: Tokens | null = tokens(),
) {
  const calls: { url: string; init: RequestInit }[] = [];
  let n = 0;
  const store = memoryStore(initial);
  let uuidN = 0;
  const onSessionExpired = jest.fn();
  const client = new ApiClient({
    baseUrl: 'http://api.test',
    store,
    uuid: () => `uuid-${++uuidN}`,
    sleep: async () => undefined,
    onSessionExpired,
    fetchImpl: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return handler({ url, init, call: ++n });
    }) as unknown as typeof fetch,
  });
  return { client, calls, store, onSessionExpired };
}

const header = (c: { init: RequestInit }, name: string) => (c.init.headers as Record<string, string>)[name];

describe('ApiClient', () => {
  it('sends bearer auth and a fresh correlation id on every call', async () => {
    const { client, calls } = setup(() => json(200, { ok: true }));
    await client.get('requests/active');
    await client.get('requests/active');
    expect(header(calls[0]!, 'authorization')).toBe('Bearer access-1');
    expect(header(calls[0]!, 'x-correlation-id')).not.toBe(header(calls[1]!, 'x-correlation-id'));
    expect(calls[0]!.url).toBe('http://api.test/api/v1/requests/active');
  });

  it('attaches an Idempotency-Key to keyed mutations and reuses it across automatic retries', async () => {
    const { client, calls } = setup(({ call }) => {
      if (call < 3) throw new TypeError('Network request failed'); // first two attempts: timeout/offline
      return json(200, { state: 'CONFIRMED' });
    });
    const res = await client.post<{ state: string }>(
      'requests/r1/confirm',
      { technicianId: 't1' },
      { idempotencyKey: true },
    );
    expect(res.state).toBe('CONFIRMED');
    expect(calls).toHaveLength(3);
    const keys = calls.map((c) => header(c, 'idempotency-key'));
    expect(keys[0]).toBeTruthy();
    expect(new Set(keys).size).toBe(1); // same key every attempt => the server replays instead of repeating
  });

  it('reuses a caller-supplied key across separate user taps (retry after an unknown outcome)', async () => {
    const { client, calls } = setup(
      ({ call }) =>
        call === 1 ? json(503, { code: 'INTERNAL', message: 'x', correlationId: 'c' }) : json(200, {}),
      tokens(),
    );
    await client.post('requests/r1/stop', {}, { idempotencyKey: 'tap-key-0001' });
    expect(calls.map((c) => header(c, 'idempotency-key'))).toEqual(['tap-key-0001', 'tap-key-0001']);
  });

  it('does NOT retry an un-keyed POST (repeating it could duplicate the action)', async () => {
    const { client, calls } = setup(() => {
      throw new TypeError('Network request failed');
    });
    await expect(client.post('requests', { assetId: 'A' })).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK',
    });
    expect(calls).toHaveLength(1);
  });

  it('retries GETs on 502/503/504 with a bounded number of attempts', async () => {
    const { client, calls } = setup(() =>
      json(503, { code: 'INTERNAL', message: 'down', correlationId: 'c' }),
    );
    await expect(client.get('requests/active')).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(3); // 1 + 2 retries
  });

  it('does not retry definite client errors', async () => {
    const { client, calls } = setup(() =>
      json(409, { code: 'STATE_CONFLICT', message: 'nope', correlationId: 'corr-9' }),
    );
    const err = (await client
      .post('requests/r/confirm', {}, { idempotencyKey: true })
      .catch((e) => e)) as ApiError;
    expect(err).toMatchObject({
      status: 409,
      code: 'STATE_CONFLICT',
      correlationId: 'corr-9',
      message: 'nope',
    });
    expect(calls).toHaveLength(1);
  });

  it('refreshes once (single-flight) when several calls hit 401 together, then retries them', async () => {
    let refreshCalls = 0;
    const { client, store } = setup(({ url, init }) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls++;
        return json(200, {
          accessToken: 'access-2',
          refreshToken: 'refresh-2',
          expiresIn: 900,
          user: { id: 'u', name: 'n', role: 'REQUESTER' },
        });
      }
      return (init.headers as Record<string, string>).authorization === 'Bearer access-2'
        ? json(200, { ok: 1 })
        : json(401, { code: 'UNAUTHENTICATED', message: 'x', correlationId: 'c' });
    });
    const results = await Promise.all([client.get('a'), client.get('b'), client.get('c')]);
    expect(results).toHaveLength(3);
    expect(refreshCalls).toBe(1); // refresh tokens rotate: parallel refreshes would trip reuse detection
    expect(store.current?.refreshToken).toBe('refresh-2');
  });

  it('drops the session and notifies the app when the refresh fails', async () => {
    const { client, store, onSessionExpired } = setup(({ url }) =>
      url.endsWith('/auth/refresh')
        ? json(401, { code: 'UNAUTHENTICATED', message: 'x', correlationId: 'c' })
        : json(401, { code: 'UNAUTHENTICATED', message: 'x', correlationId: 'c' }),
    );
    await expect(client.get('requests/active')).rejects.toMatchObject({ status: 401 });
    expect(store.current).toBeNull();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when the refresh itself fails because the device is offline', async () => {
    const { client, store } = setup(({ url }) => {
      if (url.endsWith('/auth/refresh')) throw new TypeError('Network request failed');
      return json(401, { code: 'UNAUTHENTICATED', message: 'x', correlationId: 'c' });
    });
    await expect(client.get('requests/active')).rejects.toBeInstanceOf(ApiError);
    expect(store.current).not.toBeNull();
  });

  it('login stores tokens; anonymous calls carry no Authorization header', async () => {
    const { client, calls, store } = setup(
      () =>
        json(200, {
          accessToken: 'a',
          refreshToken: 'r',
          expiresIn: 900,
          user: { id: 'u', name: 'n', role: 'TECHNICIAN' },
        }),
      null,
    );
    const pair = await client.login('x@y.test', 'pw');
    expect(pair.user.role).toBe('TECHNICIAN');
    expect(header(calls[0]!, 'authorization')).toBeUndefined();
    expect(store.current?.accessToken).toBe('a');
    expect(await client.hasSession()).toBe(true);
  });

  it('freshAccessToken refreshes tokens that are about to expire', async () => {
    const { client } = setup(
      () =>
        json(200, {
          accessToken: 'new-access',
          refreshToken: 'r2',
          expiresIn: 900,
          user: { id: 'u', name: 'n', role: 'REQUESTER' },
        }),
      tokens({ expiresAtMs: Date.now() + 1000 }),
    );
    expect(await client.freshAccessToken()).toBe('new-access');
  });
});
