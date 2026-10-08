import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ERROR_CODES, ErrorCode, ErrorEnvelope } from '@dispatch/contracts';
import { AppException } from './app-exception';
import { resolveCorrelationId } from './context';

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'VALIDATION_FAILED',
  415: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
};

/** Maps every error to {code,message,correlationId,details?}. Never leaks stacks, SQL or input values. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') return;
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const correlationId = resolveCorrelationId(req as never);

    let status: number = ERROR_CODES.INTERNAL;
    let code: ErrorCode = 'INTERNAL';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof ZodValidationException) {
      status = 400;
      code = 'VALIDATION_FAILED';
      message = 'Request validation failed';
      const err = exception.getZodError() as {
        issues?: { path: (string | number)[]; message: string; code: string }[];
      };
      // Paths and messages only: never echo submitted values.
      details = (err.issues ?? []).map((i) => ({ path: i.path.join('.'), code: i.code, message: i.message }));
    } else if (exception instanceof AppException) {
      status = exception.getStatus();
      code = exception.code;
      message = (exception.getResponse() as { message: string }).message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = STATUS_TO_CODE[status] ?? (status >= 500 ? 'INTERNAL' : 'VALIDATION_FAILED');
      message = status >= 500 ? 'Internal server error' : this.safeMessage(code);
    } else if (this.isClientError(exception)) {
      // e.g. body-parser: malformed JSON / payload too large
      status = (exception as { status: number }).status;
      code = STATUS_TO_CODE[status] ?? 'VALIDATION_FAILED';
      message = this.safeMessage(code);
    } else {
      this.logger.error(
        { correlationId, err: exception instanceof Error ? exception.stack : String(exception) },
        'Unhandled error',
      );
    }

    // Requests outside /api/v1 (typos, browsers probing, bad base URLs) bypass the request logger, so a user who
    // reports a correlation id from a bare 404 could not be traced. Log those here, once, without query strings.
    if (status === 404 && !req.path.startsWith('/api/v1') && req.path !== '/favicon.ico') {
      this.logger.warn({ correlationId, method: req.method, path: req.path }, 'Unmatched route');
    }

    const body: ErrorEnvelope = {
      code,
      message,
      correlationId,
      ...(details !== undefined ? { details } : {}),
    };
    res.status(status).json(body);
  }

  private isClientError(e: unknown): boolean {
    const s = (e as { status?: unknown })?.status;
    return typeof s === 'number' && s >= 400 && s < 500;
  }

  private safeMessage(code: ErrorCode): string {
    switch (code) {
      case 'UNAUTHENTICATED':
        return 'Authentication required';
      case 'FORBIDDEN':
        return 'You are not allowed to perform this action';
      case 'NOT_FOUND':
        return 'Resource not found';
      case 'RATE_LIMITED':
        return 'Too many requests';
      default:
        return 'Request validation failed';
    }
  }
}
