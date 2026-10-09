import { HttpException } from '@nestjs/common';
import { ERROR_CODES, ErrorCode } from '@dispatch/contracts';

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Request validation failed',
  UNAUTHENTICATED: 'Authentication required',
  FORBIDDEN: 'You are not allowed to perform this action',
  NOT_FOUND: 'Resource not found',
  STATE_CONFLICT: 'The request is not in a state that allows this action',
  ILLEGAL_TRANSITION: 'Illegal state transition',
  TECHNICIAN_UNAVAILABLE: 'The technician is no longer available',
  EVIDENCE_REQUIRED: 'At least two finalized evidence images are required',
  IDEMPOTENCY_MISMATCH: 'Idempotency-Key was already used with a different request',
  IDEMPOTENCY_IN_PROGRESS: 'A request with this Idempotency-Key is still being processed',
  IDEMPOTENCY_KEY_REQUIRED: 'A valid Idempotency-Key header is required',
  OTP_INVALID: 'Invalid or expired code',
  OTP_LOCKED: 'Too many attempts. Try again later',
  RATE_LIMITED: 'Too many requests',
  MEDIA_REJECTED: 'The uploaded file was rejected',
  HTTPS_REQUIRED: 'This API is only served over HTTPS/WSS',
  INTERNAL: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Try again shortly',
};

/** Domain/application error carrying a stable, client-visible code. */
export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly details?: unknown,
  ) {
    super({ code, message: message ?? DEFAULT_MESSAGES[code] }, ERROR_CODES[code]);
  }
}
