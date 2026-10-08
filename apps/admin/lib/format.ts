import { formatDuration, formatMoney, relativeTime } from '@dispatch/ui-tokens';

// Display formatting is shared with the mobile app through @dispatch/ui-tokens.
export { formatDuration, formatMoney };
export const timeAgo = relativeTime;

export const FLAG_LABEL: Record<string, string> = {
  NO_TECHNICIAN: 'No technician yet',
  TECHNICIAN_STALE: 'Technician stale',
  REVIEW_OVERDUE: 'Review overdue',
  REWORK_OPEN: 'Rework open',
  MULTIPLE_REWORKS: 'Multiple reworks',
};

export const TERMINAL = new Set(['SETTLED', 'CANCELLED', 'COMPLETED']);

/**
 * Elapsed work time from SERVER timestamps. `serverTime` was sent with the payload fetched at `fetchedAtMs`
 * (client clock), so `now - fetchedAt + serverTime` is the server's "now" without trusting the client clock's absolute value.
 */
export function elapsedSeconds(
  startedAt: string | null,
  serverTime: string,
  fetchedAtMs: number,
  nowMs: number,
): number | null {
  if (!startedAt) return null;
  const serverNow = Date.parse(serverTime) + (nowMs - fetchedAtMs);
  return Math.max(0, Math.floor((serverNow - Date.parse(startedAt)) / 1000));
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export const humanize = (s: string): string => s.toLowerCase().replace(/_/g, ' ');
