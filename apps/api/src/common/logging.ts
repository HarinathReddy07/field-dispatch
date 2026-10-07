import type { Writable } from 'node:stream';
import type { Options } from 'pino-http';
import type { Env } from '@dispatch/config';
import { resolveCorrelationId } from './context';

/**
 * Request logging policy.
 *  - Only an allow-list of request fields is serialized (method, path without query string, status):
 *    no headers, no bodies, so credentials, OTPs and tokens never reach the log line.
 *  - `redact` is defence in depth for anything that might be logged by future code.
 */
export function buildPinoHttpOptions(
  env: Env,
  overrides: { stream?: Writable; level?: string } = {},
): Options {
  return {
    level: overrides.level ?? (env.NODE_ENV === 'test' ? 'silent' : 'info'),
    ...(overrides.stream ? { stream: overrides.stream } : {}),
    genReqId: (req) => resolveCorrelationId(req as never),
    customProps: (req) => ({ correlationId: (req as { id?: string }).id }),
    serializers: {
      req: (req: { id: string; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url.split('?')[0],
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.otp',
        'req.body.refreshToken',
        '*.password',
        '*.otp',
        '*.token',
        '*.accessToken',
        '*.refreshToken',
        '*.otp_hmac',
      ],
      censor: '[REDACTED]',
    },
    autoLogging: { ignore: (req) => (req.url ?? '').includes('/health/') },
  };
}
