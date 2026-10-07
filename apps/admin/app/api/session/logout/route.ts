import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/config';
import { apiUrl, clearSession } from '@/lib/session';

async function end(): Promise<void> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (token) {
    await fetch(apiUrl('auth/logout'), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
  await clearSession();
}

export async function POST() {
  await end();
  return NextResponse.json({ ok: true });
}

/** Used by server-side checks to drop a session that is not allowed here, then land on the login page. */
export async function GET(req: NextRequest) {
  await end();
  return NextResponse.redirect(new URL('/login', req.url));
}
