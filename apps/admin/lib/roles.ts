import type { Role } from '@dispatch/contracts';

/** Where each role lands after signing in. The server decides the role; the client only follows this map. */
export const ROLE_HOME: Record<Role, string> = {
  ADMIN: '/admin',
  REQUESTER: '/app',
  TECHNICIAN: '/tech',
};

export const homeFor = (role: string): string => ROLE_HOME[role as Role] ?? '/login';

export const isRole = (v: unknown): v is Role => v === 'ADMIN' || v === 'REQUESTER' || v === 'TECHNICIAN';
