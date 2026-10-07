import type { TokenPair } from '@dispatch/contracts';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** epoch ms when the access token expires (client clock; only used to refresh early). */
  expiresAtMs: number;
}

/** Where tokens live. Production: expo-secure-store. Tests: in-memory. */
export interface TokenStore {
  get(): Promise<Tokens | null>;
  set(tokens: Tokens | null): Promise<void>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly correlationId?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  /** Network failure (no HTTP response at all). */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export interface ClientOptions {
  baseUrl: string;
  store: TokenStore;
  fetchImpl?: typeof fetch;
  uuid: () => string;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  onSessionExpired?: () => void;
  maxRetries?: number;
}

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /**
   * `true` generates a fresh Idempotency-Key for this call; a string reuses the key of an earlier attempt of the SAME user action,
   * so a retry after a timeout replays the original result instead of repeating the action.
   */
  idempotencyKey?: string | true;
  /** Skip the Authorization header (login/refresh). */
  anonymous?: boolean;
}

export const isRetryableStatus = (status: number): boolean =>
  status === 502 || status === 503 || status === 504;
export const backoffMs = (attempt: number): number => Math.min(250 * 2 ** attempt, 2000);

/**
 * Typed API client: bearer auth with single-flight refresh, a correlation id on every call, Idempotency-Key for
 * mutations, and bounded retries that are only ever applied when repeating the request is safe (GET, or a keyed request).
 */
export class ApiClient {
  private refreshing: Promise<Tokens | null> | null = null;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly maxRetries: number;

  constructor(private readonly opts: ClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = opts.now ?? Date.now;
    this.maxRetries = opts.maxRetries ?? 2;
  }

  get baseUrl(): string {
    return this.opts.baseUrl;
  }

  async request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, o: RequestOptions = {}): Promise<T> {
    const key = o.idempotencyKey === true ? this.opts.uuid() : o.idempotencyKey;
    const safeToRepeat = method === 'GET' || key !== undefined;
    let refreshed = false;

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.fetchImpl(this.url(path, o.query), {
          method,
          headers: await this.headers(o, key),
          body: o.body === undefined ? undefined : JSON.stringify(o.body),
        });
      } catch {
        if (safeToRepeat && attempt < this.maxRetries) {
          await this.sleep(backoffMs(attempt));
          continue;
        }
        throw new ApiError(0, 'NETWORK', 'Network request failed');
      }

      if (res.status === 401 && !o.anonymous && !refreshed) {
        refreshed = true;
        if (await this.refresh()) continue;
        throw new ApiError(401, 'UNAUTHENTICATED', 'Session expired');
      }
      if (isRetryableStatus(res.status) && safeToRepeat && attempt < this.maxRetries) {
        await this.sleep(backoffMs(attempt));
        continue;
      }
      return this.parse<T>(res);
    }
  }

  get = <T>(path: string, query?: RequestOptions['query']) => this.request<T>('GET', path, { query });
  post = <T>(path: string, body?: unknown, o: Omit<RequestOptions, 'body'> = {}) =>
    this.request<T>('POST', path, { ...o, body: body ?? {} });
  patch = <T>(path: string, body: unknown) => this.request<T>('PATCH', path, { body });

  async login(email: string, password: string): Promise<TokenPair> {
    const pair = await this.request<TokenPair>('POST', 'auth/login', {
      body: { email, password },
      anonymous: true,
    });
    await this.opts.store.set(this.toTokens(pair));
    return pair;
  }

  async logout(): Promise<void> {
    try {
      await this.request<void>('POST', 'auth/logout', { body: {} });
    } catch {
      /* best effort: the local session is dropped regardless */
    }
    await this.opts.store.set(null);
  }

  /** A valid access token for the socket handshake (refreshing when it is about to expire). */
  async freshAccessToken(): Promise<string | null> {
    const t = await this.opts.store.get();
    if (!t) return null;
    if (t.expiresAtMs - this.now() > 20_000) return t.accessToken;
    return (await this.refresh())?.accessToken ?? null;
  }

  async hasSession(): Promise<boolean> {
    return (await this.opts.store.get()) !== null;
  }

  private toTokens(pair: TokenPair): Tokens {
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      expiresAtMs: this.now() + pair.expiresIn * 1000,
    };
  }

  /** Single-flight: concurrent 401s share one refresh (refresh tokens rotate; two parallel uses would revoke the family). */
  private refresh(): Promise<Tokens | null> {
    this.refreshing ??= (async () => {
      try {
        const current = await this.opts.store.get();
        if (!current) return null;
        const res = await this.fetchImpl(this.url('auth/refresh'), {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-correlation-id': this.opts.uuid() },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        if (!res.ok) {
          await this.opts.store.set(null);
          this.opts.onSessionExpired?.();
          return null;
        }
        const next = this.toTokens((await res.json()) as TokenPair);
        await this.opts.store.set(next);
        return next;
      } catch {
        return null; // offline: keep the session, the caller surfaces a network error
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  private url(path: string, query?: RequestOptions['query']): string {
    const q = Object.entries(query ?? {})
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    return `${this.opts.baseUrl.replace(/\/$/, '')}/api/v1/${path.replace(/^\//, '')}${q ? `?${q}` : ''}`;
  }

  private async headers(o: RequestOptions, key: string | undefined): Promise<Record<string, string>> {
    const h: Record<string, string> = { 'x-correlation-id': this.opts.uuid() };
    if (o.body !== undefined) h['content-type'] = 'application/json';
    if (key) h['idempotency-key'] = key;
    if (!o.anonymous) {
      const t = await this.opts.store.get();
      if (t) h.authorization = `Bearer ${t.accessToken}`;
    }
    return h;
  }

  private async parse<T>(res: Response): Promise<T> {
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const e = (data ?? {}) as {
        code?: string;
        message?: string;
        correlationId?: string;
        details?: unknown;
      };
      throw new ApiError(
        res.status,
        e.code ?? 'ERROR',
        e.message ?? res.statusText,
        e.correlationId,
        e.details,
      );
    }
    return data as T;
  }
}
