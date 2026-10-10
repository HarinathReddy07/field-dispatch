import { NextRequest, NextResponse } from 'next/server';
import type { TokenPair } from '@dispatch/contracts';
import { homeFor } from '@/lib/roles';
import { apiUrl, writeSession } from '@/lib/session';

/**
 * POST /api/session/otp
 *
 * Two actions:
 *   { action: "request", email }       -> asks the API to send an OTP email
 *   { action: "verify", email, otp }   -> verifies the OTP; on success writes the session
 *
 * Backend must expose:
 *   POST /auth/otp/request  { email }
 *   POST /auth/otp/verify   { email, otp }  -> TokenPair
 *
 * If those endpoints are not deployed this route returns 501 gracefully.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== 'string') {
    return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
  }

  // OTP request
  if (body.action === 'request') {
    if (typeof body.email !== 'string' || !body.email.includes('@')) {
      return NextResponse.json({ message: 'A valid email address is required' }, { status: 400 });
    }
    const res = await fetch(apiUrl('auth/otp/request'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: body.email }),
      cache: 'no-store',
    });
    if (res.status === 429)
      return NextResponse.json(
        { message: 'Too many attempts. Wait a minute and try again.' },
        { status: 429 },
      );
    if (res.status === 501 || res.status === 404)
      return NextResponse.json(
        { message: 'Email OTP is not available in this deployment.' },
        { status: 501 },
      );
    if (!res.ok)
      return NextResponse.json(
        { message: 'Could not send the code. Check the email and try again.' },
        { status: 400 },
      );
    return NextResponse.json({ sent: true });
  }

  // OTP verify
  if (body.action === 'verify') {
    if (typeof body.email !== 'string' || typeof body.otp !== 'string') {
      return NextResponse.json({ message: 'Email and code are required' }, { status: 400 });
    }
    const res = await fetch(apiUrl('auth/otp/verify'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: body.email, otp: body.otp }),
      cache: 'no-store',
    });
    if (res.status === 429)
      return NextResponse.json(
        { message: 'Too many attempts. Try again in a few minutes.' },
        { status: 429 },
      );
    if (res.status === 501 || res.status === 404)
      return NextResponse.json(
        { message: 'Email OTP is not available in this deployment.' },
        { status: 501 },
      );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { message: (err as { message?: string }).message ?? 'Invalid or expired code.' },
        { status: 401 },
      );
    }
    const pair = (await res.json()) as TokenPair;
    await writeSession(pair);
    return NextResponse.json({ user: pair.user, home: homeFor(pair.user.role) });
  }

  return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
}
