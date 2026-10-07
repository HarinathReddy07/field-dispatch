export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Calls the admin API through the same-origin gateway (cookies stay httpOnly; the bearer is attached server-side). */
export async function api<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, {
    method: init.method ?? 'GET',
    headers: init.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
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
    const e = (data ?? {}) as { code?: string; message?: string; details?: unknown };
    throw new ApiError(res.status, e.code ?? 'ERROR', e.message ?? res.statusText, e.details);
  }
  return data as T;
}
