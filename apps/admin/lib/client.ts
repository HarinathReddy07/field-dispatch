import { uuid } from './ids.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  /** Correlation id from the error envelope; shown (and copyable) in the UI so support can find the request. */
  readonly correlationId?: string;

  // Explicit fields (not parameter properties) so the file also runs under Node's type-stripping in unit tests.
  constructor(status: number, code: string, message: string, details?: unknown, correlationId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.correlationId = correlationId;
  }
  /** No HTTP response at all (offline, DNS, server down). */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export interface ApiInit {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  /** Idempotency-Key for the mutation. Reuse the SAME key when retrying one user action (see useAction). */
  idempotencyKey?: string;
}

/** Calls the API through the same-origin gateway (cookies stay httpOnly; the bearer is attached server-side). */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'x-correlation-id': uuid() };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.idempotencyKey) headers['idempotency-key'] = init.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`/api/proxy/${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network error');
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  // full navigation on purpose: drops all client state once the session is gone
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  if (res.status === 401 && typeof window !== 'undefined') window.location.href = '/login';
  if (!res.ok) {
    const e = (data ?? {}) as { code?: string; message?: string; details?: unknown; correlationId?: string };
    throw new ApiError(
      res.status,
      e.code ?? 'ERROR',
      e.message ?? res.statusText,
      e.details,
      e.correlationId ?? res.headers.get('x-correlation-id') ?? undefined,
    );
  }
  return data as T;
}
