import { redirect } from 'next/navigation';
import type { Role } from '@dispatch/contracts';
import { homeFor } from './roles';
import { getMe, type Me } from './session';

/**
 * Server-side gate for a role's area. The role is whatever the API says (GET /auth/me), never a cookie or client flag.
 * Wrong role: sent to their own area. Expired access token: refreshed, then back to this area.
 * Returns `null` when the API cannot be reached, so the layout can show an outage instead of looping.
 */
export async function requireRole(role: Role): Promise<Me | null> {
  const { status, me } = await getMe();
  if (status === 401) redirect(`/api/session/refresh?next=${encodeURIComponent(homeFor(role))}`);
  if (status === 0 || status >= 500) return null;
  if (!me) redirect('/api/session/logout');
  if (me.role !== role) redirect(homeFor(me.role));
  return me;
}
