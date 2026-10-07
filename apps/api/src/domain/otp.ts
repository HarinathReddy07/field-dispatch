import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const OTP_LENGTH = 6;

/** Cryptographically strong zero-padded numeric code. */
export function generateOtp(rand: (min: number, max: number) => number = randomInt): string {
  return String(rand(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

/** HMAC-SHA256 bound to the request, so a hash can't be replayed against another request. */
export function hmacOtp(secret: string, requestId: string, otp: string): string {
  return createHmac('sha256', secret).update(`${requestId}:${otp}`).digest('hex');
}

/** Constant-time comparison of the submitted OTP against the stored HMAC. */
export function verifyOtp(secret: string, requestId: string, otp: string, storedHmac: string): boolean {
  const a = Buffer.from(hmacOtp(secret, requestId, otp), 'hex');
  const b = Buffer.from(storedHmac, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface OtpAttemptInput {
  attempts: number;
  maxAttempts: number;
  lockedUntil: Date | null;
  now: Date;
  lockSeconds: number;
  correct: boolean;
  expired: boolean;
  consumed: boolean;
}

export interface OtpAttemptResult {
  /** OK: consume the challenge. INVALID: uniform failure. LOCKED: temporarily blocked. */
  outcome: 'OK' | 'INVALID' | 'LOCKED';
  attempts: number;
  lockedUntil: Date | null;
}

/**
 * Pure attempt/lock policy. The attempt that reaches the limit still answers INVALID (uniform),
 * sets the lock, and resets the counter so a fresh budget starts after the lock expires.
 */
export function evaluateOtpAttempt(i: OtpAttemptInput): OtpAttemptResult {
  const lockActive = i.lockedUntil !== null && i.lockedUntil.getTime() > i.now.getTime();
  if (lockActive) return { outcome: 'LOCKED', attempts: i.attempts, lockedUntil: i.lockedUntil };

  const attempts = i.lockedUntil !== null ? 0 : i.attempts; // lock expired -> fresh budget
  if (i.consumed || i.expired) return { outcome: 'INVALID', attempts, lockedUntil: null };
  if (i.correct) return { outcome: 'OK', attempts, lockedUntil: null };

  const next = attempts + 1;
  if (next >= i.maxAttempts) {
    return { outcome: 'INVALID', attempts: 0, lockedUntil: new Date(i.now.getTime() + i.lockSeconds * 1000) };
  }
  return { outcome: 'INVALID', attempts: next, lockedUntil: null };
}
