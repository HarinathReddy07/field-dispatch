/** Indian digit grouping (12,34,567) without Intl, so Hermes and Node print exactly the same text. */
function groupIndian(integer: string): string {
  if (integer.length <= 3) return integer;
  const last3 = integer.slice(-3);
  const rest = integer.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** 46500 gives "₹465.00". Minor units are integers (paise); null/undefined render an em dash. */
export function formatMoney(minor: number | null | undefined): string {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return '—';
  const sign = minor < 0 ? '-' : '';
  const abs = Math.round(Math.abs(minor));
  const rupees = Math.floor(abs / 100);
  const paise = String(abs % 100).padStart(2, '0');
  return `${sign}₹${groupIndian(String(rupees))}.${paise}`;
}

export function formatDistanceKm(km: number | null | undefined): string {
  if (km === null || km === undefined || !Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${(Math.round(km * 10) / 10).toFixed(1)} km`;
}

/** 725 gives "12:05", 3729 gives "1:02:09". */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds)) return '—';
  const t = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** Relative age of `date` at `now` ("just now", "42s ago", "3m ago", "2h ago", "4d ago"). */
export function relativeTime(date: string | number | Date | null | undefined, now: number | Date): string {
  if (date === null || date === undefined) return 'never';
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return '—';
  const s = Math.max(0, Math.round((new Date(now).getTime() - then) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
