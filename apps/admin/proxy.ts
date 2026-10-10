import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './lib/config';

/**
 * Optimistic gate only (docs: Proxy is not an authorization layer): no session cookie -> login.
 * Real checks happen server-side in the admin, requester and technician layouts (role from the API) and in every API call.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const open =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/unauthorized' ||
    pathname === '/api/session/login' ||
    pathname === '/api/session/otp' ||
    pathname === '/api/session/logout' ||
    /\.(jpe?g|png|gif|svg|webp|ico|woff2?)$/i.test(pathname);
  if (open) return NextResponse.next();

  const hasSession = req.cookies.has(ACCESS_COOKIE) || req.cookies.has(REFRESH_COOKIE);
  if (hasSession) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      { status: 401 },
    );
  }
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
