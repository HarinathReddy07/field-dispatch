import { NextResponse } from 'next/server';
import { API_PUBLIC_URL } from '@/lib/config';
import { jwtExpiry } from '@/lib/jwt.ts';
import { ensureAccessToken } from '@/lib/session';

/** Short-lived access token for the browser's Socket.io handshake (the cookie itself stays httpOnly). */
export async function GET() {
  const token = await ensureAccessToken();
  if (!token) return NextResponse.json({ message: 'Not signed in' }, { status: 401 });
  return NextResponse.json(
    { token, expiresAt: jwtExpiry(token), apiUrl: API_PUBLIC_URL },
    { headers: { 'cache-control': 'no-store' } },
  );
}
