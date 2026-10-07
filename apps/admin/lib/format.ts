export type Tone = 'neutral' | 'info' | 'warn' | 'good' | 'bad';

export const STATE_TONE: Record<string, Tone> = {
  DRAFT: 'neutral',
  REQUESTED: 'neutral',
  MATCHED: 'info',
  CONFIRMED: 'info',
  ARRIVED: 'info',
  IN_PROGRESS: 'warn',
  PROOF_UPLOADED: 'warn',
  UNDER_REVIEW: 'warn',
  REWORK: 'bad',
  COMPLETED: 'good',
  SETTLED: 'good',
  CANCELLED: 'bad',
};

export const FLAG_LABEL: Record<string, string> = {
  NO_TECHNICIAN: 'No technician yet',
  TECHNICIAN_STALE: 'Technician offline',
  REVIEW_OVERDUE: 'Review overdue',
  REWORK_OPEN: 'Rework open',
  MULTIPLE_REWORKS: 'Repeated rework',
};

export const TERMINAL = new Set(['SETTLED', 'CANCELLED', 'COMPLETED']);

export function formatMoney(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(minor / 100);
}

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

export function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null) return '—';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function timeAgo(iso: string | null, nowMs: number): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const humanize = (s: string): string => s.toLowerCase().replace(/_/g, ' ');
