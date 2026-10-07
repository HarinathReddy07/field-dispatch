import { NextRequest, NextResponse } from 'next/server';
import type { TokenPair } from '@dispatch/contracts';
import { apiUrl, writeSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  if (typeof body?.email !== 'string' || typeof body?.password !== 'string') {
    return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
  }
  const res = await fetch(apiUrl('auth/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: 'no-store',
  });
  if (res.status === 429)
    return NextResponse.json({ message: 'Too many attempts. Try again shortly.' }, { status: 429 });
  if (!res.ok) return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });

  const pair = (await res.json()) as TokenPair;
  if (pair.user.role !== 'ADMIN') {
    // Not an admin: revoke the session we just created and never store it. Role comes from the API, not the client.
    await fetch(apiUrl('auth/logout'), {
      method: 'POST',
      headers: { authorization: `Bearer ${pair.accessToken}` },
    });
    return NextResponse.json({ message: 'This console is for operations admins only' }, { status: 403 });
  }
  await writeSession(pair);
  return NextResponse.json({ user: pair.user });
}
