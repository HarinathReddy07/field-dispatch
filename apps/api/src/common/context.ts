import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface RequestCtx {
  correlationId: string;
  userId?: string;
  role?: string;
}

export const ctxStore = new AsyncLocalStorage<RequestCtx>();

export const currentCorrelationId = (): string | null => ctxStore.getStore()?.correlationId ?? null;

const CORRELATION_RE = /^[A-Za-z0-9._-]{8,64}$/;

interface HasHeaders {
  headers: Record<string, unknown>;
  __cid?: string;
}

/** Same id for pino-http, our middleware and the exception filter (cached on the request). */
export function resolveCorrelationId(req: HasHeaders): string {
  if (req.__cid) return req.__cid;
  const header = req.headers['x-correlation-id'];
  const id = typeof header === 'string' && CORRELATION_RE.test(header) ? header : randomUUID();
  req.__cid = id;
  return id;
}
