/** Server-side configuration (read at runtime, never baked into the client bundle). */
export const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';
/** Address the BROWSER uses for the Socket.io connection. */
export const API_PUBLIC_URL = process.env.PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Cookies are `Secure` in production. Plain-HTTP deployments (local docker demo) must opt out
 * explicitly with ADMIN_COOKIE_SECURE=false; this is a local-development flag, not a default.
 */
export const COOKIE_SECURE =
  (process.env.ADMIN_COOKIE_SECURE ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')) === 'true';

export const ACCESS_COOKIE = 'dispatch_at';
export const REFRESH_COOKIE = 'dispatch_rt';
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;
