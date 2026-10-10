import { ApiError } from './client.ts';

const BY_CODE: Record<string, string> = {
  UNAUTHENTICATED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: 'You don’t have access to do that.',
  NOT_FOUND: 'We couldn’t find that. It may have been removed or reassigned.',
  STATE_CONFLICT: 'This job just changed. We’ve refreshed it, so please check and try again.',
  ILLEGAL_TRANSITION: 'This job just changed. We’ve refreshed it, so please check and try again.',
  TECHNICIAN_UNAVAILABLE: 'That technician was just booked. Please pick another one.',
  EVIDENCE_REQUIRED: 'Add at least two photos before you submit for review.',
  OTP_INVALID: 'That code isn’t valid. Ask the customer for a new one.',
  OTP_LOCKED: 'Too many attempts. Wait a few minutes, then try again.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  MEDIA_REJECTED: 'That photo couldn’t be accepted. Use a JPEG or PNG under 5 MB.',
  VALIDATION_FAILED: 'Please check the details you entered.',
  IDEMPOTENCY_IN_PROGRESS: 'That is already being processed. Please wait a moment.',
  IDEMPOTENCY_MISMATCH: 'That action changed while it was sending. Please try again.',
  IDEMPOTENCY_KEY_REQUIRED: 'Something went wrong on our side. Please try again.',
  SERVICE_UNAVAILABLE: 'The service is busy right now. Please try again shortly.',
};

/** Plain-language message for any error. Error codes are never shown to users; support finds them by correlation id. */
export function friendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNetwork) return 'We couldn’t reach the server. Check your connection and try again.';
    const known = BY_CODE[error.code];
    if (known) return known;
    if (error.status >= 500) return 'Something went wrong on our side. Please try again shortly.';
    return 'That didn’t work. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

export const correlationOf = (error: unknown): string | undefined =>
  error instanceof ApiError ? error.correlationId : undefined;

/** Errors worth retrying with the same idempotency key: we do not know whether the server applied the action. */
export const outcomeUnknown = (error: unknown): boolean =>
  error instanceof ApiError ? error.isNetwork || error.status >= 500 : true;
