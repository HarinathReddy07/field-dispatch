import { cookies } from 'next/headers';
import type { Role, TokenPair } from '@dispatch/contracts';
import { ACCESS_COOKIE, API_INTERNAL_URL, COOKIE_SECURE, REFRESH_COOKIE, REFRESH_MAX_AGE } from './config';
import { jwtExpiry } from './jwt.ts';

const base = { httpOnly: true, sameSite: 'strict' as const, secure: COOKIE_SECURE, path: '/' };

const ONE_HOUR_SECONDS = 3600;

export async function writeSession(pair: TokenPair): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, pair.accessToken, {
    ...base,
    maxAge: Math.min(pair.expiresIn || ONE_HOUR_SECONDS, ONE_HOUR_SECONDS),
  });
  jar.set(REFRESH_COOKIE, pair.refreshToken, { ...base, maxAge: ONE_HOUR_SECONDS });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export function apiUrl(path: string): string {
  return `${API_INTERNAL_URL}/api/v1/${path.replace(/^\//, '')}`;
}

/** Exchanges the refresh cookie for a new pair (rotating). Only call from route handlers (they may set cookies). */
export async function refreshSession(): Promise<string | null> {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  const res = await fetch(apiUrl('auth/refresh'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  if (!res.ok) {
    await clearSession();
    return null;
  }
  const pair = (await res.json()) as TokenPair;
  await writeSession(pair);
  return pair.accessToken;
}

/** Returns a usable access token, refreshing when missing or about to expire. Route handlers only. */
export async function ensureAccessToken(minValiditySeconds = 30): Promise<string | null> {
  const jar = await cookies();
  const current = jar.get(ACCESS_COOKIE)?.value;
  if (current) {
    const exp = jwtExpiry(current);
    if (exp !== null && exp - Date.now() / 1000 > minValiditySeconds) return current;
  }
  return refreshSession();
}

/** Server-component helper: calls the API with the current access cookie. Never refreshes (can't set cookies). */
export async function serverApi<T>(path: string): Promise<{ status: number; data: T | null }> {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) return { status: 401, data: null };
  const res = await fetch(apiUrl(path), { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
  return { status: res.status, data: res.ok ? ((await res.json()) as T) : null };
}

export interface Me {
  id: string;
  name: string;
  role: Role;
}

/**
 * The signed-in user as the API sees them (role comes from the database, never from the client).
 * `status` is 0 when the API cannot be reached, so callers can show an outage instead of a redirect loop.
 */
export async function getMe(): Promise<{ status: number; me: Me | null }> {
  try {
    const { status, data } = await serverApi<Me>('auth/me');
    return { status, me: data };
  } catch {
    return { status: 0, me: null };
  }
}
