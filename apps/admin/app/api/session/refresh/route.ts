import { NextRequest, NextResponse } from 'next/server';
import { refreshSession } from '@/lib/session';

/** Server components can't set cookies, so an expired access token bounces through here and back. */
export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get('next') ?? '/';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'; // no open redirects
  const token = await refreshSession();
  return NextResponse.redirect(new URL(token ? safeNext : '/login', req.url));
}
