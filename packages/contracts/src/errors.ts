import { z } from 'zod';

/** Stable error codes mapped to HTTP status. */
export const ERROR_CODES = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  STATE_CONFLICT: 409,
  ILLEGAL_TRANSITION: 409,
  TECHNICIAN_UNAVAILABLE: 409,
  EVIDENCE_REQUIRED: 409,
  IDEMPOTENCY_MISMATCH: 422,
  IDEMPOTENCY_IN_PROGRESS: 409,
  IDEMPOTENCY_KEY_REQUIRED: 400,
  OTP_INVALID: 400,
  OTP_LOCKED: 429,
  RATE_LIMITED: 429,
  MEDIA_REJECTED: 422,
  HTTPS_REQUIRED: 426,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
export type ErrorCode = keyof typeof ERROR_CODES;

export const ErrorEnvelopeSchema = z.object({
  code: z.string(),
  message: z.string(),
  correlationId: z.string(),
  details: z.unknown().optional(),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
