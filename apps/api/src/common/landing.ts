import type { Env } from '@dispatch/config';
import { API_NAME, API_VERSION } from './version';

/**
 * `GET /` landing document. Opening the API port in a browser used to return a bare 404 envelope, which looks like a
 * fault; this tells a human where the real endpoints are. It is public, read-only and exposes no data.
 */
export function landingDocument(env: Pick<Env, 'SWAGGER_ENABLED'>) {
  return {
    service: API_NAME,
    version: API_VERSION,
    status: 'ok',
    note: 'This port serves the JSON API only. The operations console is a separate web app (default http://localhost:3001).',
    links: {
      apiBase: '/api/v1',
      health: '/health/ready',
      docs: env.SWAGGER_ENABLED ? '/api/docs' : null,
    },
  };
}
