import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES, ErrorEnvelope } from '@dispatch/contracts';
import { resolveCorrelationId } from './context';

/**
 * True when the request/handshake reached us over TLS. Behind the reverse proxy that terminates TLS, the proxy
 * sets X-Forwarded-Proto (the API is only reachable through it in the deployable profile; see docs/deploy-tls.md).
 */
export function isSecureTransport(headers: Record<string, unknown>, encrypted = false): boolean {
  if (encrypted) return true;
  const raw = headers['x-forwarded-proto'];
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== 'string') return false;
  const proto = first.split(',')[0]!.trim().toLowerCase();
  return proto === 'https' || proto === 'wss';
}

/** Deployable profile only: plain HTTP is refused (health probes stay reachable for the orchestrator). */
export function requireHttps(req: Request, res: Response, next: NextFunction): void {
  if (req.path.startsWith('/health/') || isSecureTransport(req.headers, req.secure)) return next();
  const body: ErrorEnvelope = {
    code: 'HTTPS_REQUIRED',
    message: 'This API is only served over HTTPS/WSS',
    correlationId: resolveCorrelationId(req as never),
  };
  res.status(ERROR_CODES.HTTPS_REQUIRED).json(body);
}
