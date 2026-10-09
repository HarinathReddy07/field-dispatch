import type { Writable } from 'node:stream';
import type { Options } from 'pino-http';
import type { Env } from '@dispatch/config';
import { currentCorrelationId, resolveCorrelationId } from './context';

const SECRET_KEYS = [
  'password',
  'otp',
  'otp_hmac',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'secret',
  'apiKey',
  'uploadUrl', // presigned evidence URLs are credentials while they are valid
];
const PRIVATE_KEYS = ['address', 'location', 'notes', 'lat', 'lon'];

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
    // EVERY line (request logs and application logs from services, the sweeper, the outbox) carries the current correlation id.
    mixin: () => ({ correlationId: currentCorrelationId() ?? undefined }),
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
        // headers that can carry credentials (the request serializer already drops headers; this is defence in depth)
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        'res.headers["set-cookie"]',
        'req.body.password',
        'req.body.otp',
        'req.body.refreshToken',
        // credentials, OTPs and tokens at the top level of a log object and one level down
        ...SECRET_KEYS.flatMap((k) => [k, `*.${k}`]),
        // private addresses and free text about a site
        ...PRIVATE_KEYS.flatMap((k) => [k, `*.${k}`]),
      ],
      censor: '[REDACTED]',
    },
    autoLogging: { ignore: (req) => (req.url ?? '').includes('/health/') },
  };
}
