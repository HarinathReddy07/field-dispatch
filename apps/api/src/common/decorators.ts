import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@dispatch/contracts';
import { AppException } from './app-exception';

export const IS_PUBLIC = 'isPublic';
export const ROLES_KEY = 'roles';
export const THROTTLE_KEY = 'throttle';

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
}

export type ThrottleBucket = 'login' | 'arrive' | 'default';

export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Every non-public handler MUST declare its roles; handlers without @Roles are denied. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const Throttle = (bucket: ThrottleBucket) => SetMetadata(THROTTLE_KEY, bucket);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user;
});

const IDEMPOTENCY_RE = /^[A-Za-z0-9_.:-]{8,128}$/;

/** Reads and validates the Idempotency-Key header (required for state-changing job endpoints). */
export const IdempotencyKey = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const raw = ctx.switchToHttp().getRequest<{ headers: Record<string, unknown> }>().headers[
    'idempotency-key'
  ];
  if (typeof raw !== 'string' || !IDEMPOTENCY_RE.test(raw))
    throw new AppException('IDEMPOTENCY_KEY_REQUIRED');
  return raw;
});
