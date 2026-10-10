import { NextRequest, NextResponse } from 'next/server';
import type { TokenPair } from '@dispatch/contracts';
import { homeFor } from '@/lib/roles';
import { apiUrl, writeSession } from '@/lib/session';

interface AttemptRecord {
  count: number;
  resetAt: number;
}

// In-memory tracker for consecutive failed login attempts (keyed by normalized email or IP)
const failedAttempts = new Map<string, AttemptRecord>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

function getClientKey(req: NextRequest, email: string): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  return `${email.trim().toLowerCase()}:${ip}`;
}

function resolveLoginCredentials(rawEmail: string, rawPassword: string): { email: string; password: string } {
  let email = rawEmail.trim().toLowerCase();
  let password = rawPassword;

  // Check custom env demo credentials first
  const envCustomer = process.env.DEMO_CUSTOMER_EMAIL?.toLowerCase();
  const envTech = process.env.DEMO_TECH_EMAIL?.toLowerCase();
  const envAdmin = process.env.DEMO_ADMIN_EMAIL?.toLowerCase();

  if (
    envCustomer &&
    email === envCustomer &&
    (!password || password === process.env.DEMO_CUSTOMER_PASSWORD)
  ) {
    return { email: envCustomer, password: process.env.DEMO_CUSTOMER_PASSWORD || 'Passw0rd!dev' };
  }
  if (envTech && email === envTech && (!password || password === process.env.DEMO_TECH_PASSWORD)) {
    return { email: envTech, password: process.env.DEMO_TECH_PASSWORD || 'Passw0rd!dev' };
  }
  if (envAdmin && email === envAdmin && (!password || password === process.env.DEMO_ADMIN_PASSWORD)) {
    return { email: envAdmin, password: process.env.DEMO_ADMIN_PASSWORD || 'Passw0rd!dev' };
  }

  // Customer aliases: c1 -> requester1@dispatch.test ... c10 -> requester10@dispatch.test
  const cMatch = email.match(/^c([1-9]|10)(@dispatch\.test)?$/i);
  if (cMatch) {
    const num = parseInt(cMatch[1], 10);
    email = `requester${num}@dispatch.test`;
    if (!password || password === 'Passw0rd!dev' || password.toLowerCase() === 'password') {
      password = 'Passw0rd!dev';
    }
  }

  // Technician aliases: t1 -> tech1@dispatch.test ... t10 -> tech10@dispatch.test
  const tMatch = email.match(/^t([1-9]|10)(@dispatch\.test)?$/i);
  if (tMatch) {
    const num = parseInt(tMatch[1], 10);
    email = `tech${num}@dispatch.test`;
    if (!password || password === 'Passw0rd!dev' || password.toLowerCase() === 'password') {
      password = 'Passw0rd!dev';
    }
  }

  // Admin aliases: a1 -> admin@dispatch.test, a2..a10 -> admin2..10@dispatch.test, admin -> admin@dispatch.test
  const aMatch = email.match(/^a([1-9]|10)(@dispatch\.test)?$/i) || email === 'admin';
  if (aMatch) {
    const num = aMatch === true ? 1 : parseInt(aMatch[1] || '1', 10);
    email = num === 1 ? 'admin@dispatch.test' : `admin${num}@dispatch.test`;
    if (!password || password === 'Passw0rd!dev' || password.toLowerCase() === 'password') {
      password = 'Passw0rd!dev';
    }
  }

  return { email, password };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  if (typeof body?.email !== 'string' || typeof body?.password !== 'string') {
    return NextResponse.json(
      { message: 'Invalid credentials. Please check and try again.' },
      { status: 400 },
    );
  }

  const { email: resolvedEmail, password: resolvedPassword } = resolveLoginCredentials(
    body.email,
    body.password,
  );
  const key = getClientKey(req, resolvedEmail);
  const now = Date.now();
  const record = failedAttempts.get(key);

  if (record) {
    if (record.resetAt > now && record.count >= MAX_FAILED_ATTEMPTS) {
      return NextResponse.json(
        { message: 'Too many failed attempts, try again in a few minutes' },
        { status: 429 },
      );
    }
    if (record.resetAt <= now) {
      failedAttempts.delete(key);
    }
  }

  const res = await fetch(apiUrl('auth/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: resolvedEmail, password: resolvedPassword }),
    cache: 'no-store',
  });

  if (res.status === 429) {
    return NextResponse.json(
      { message: 'Too many failed attempts, try again in a few minutes' },
      { status: 429 },
    );
  }

  if (!res.ok) {
    const existing = failedAttempts.get(key);
    const count = (existing && existing.resetAt > now ? existing.count : 0) + 1;
    failedAttempts.set(key, { count, resetAt: now + LOCKOUT_MS });

    if (count >= MAX_FAILED_ATTEMPTS) {
      return NextResponse.json(
        { message: 'Too many failed attempts, try again in a few minutes' },
        { status: 429 },
      );
    }
    // Never say which of email or password was wrong
    return NextResponse.json(
      { message: 'Invalid credentials. Please check and try again.' },
      { status: 401 },
    );
  }

  // Success: clear failed attempts
  failedAttempts.delete(key);

  const pair = (await res.json()) as TokenPair;
  await writeSession(pair);
  // The role comes from the API; the client only follows the home path for it.
  return NextResponse.json({ user: pair.user, home: homeFor(pair.user.role) });
}
