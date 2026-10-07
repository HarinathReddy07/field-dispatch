/**
 * Server-driven timer. The client clock is never trusted for the absolute time: when a payload arrives we
 * remember `offset = serverTime - clockAtReceipt`, and elapsed time is `(now + offset) - startedAt`.
 */
export function serverOffsetMs(serverTimeIso: string, receivedAtMs: number): number {
  return Date.parse(serverTimeIso) - receivedAtMs;
}

export function elapsedSeconds(startedAtIso: string | null, offsetMs: number, nowMs: number): number | null {
  if (!startedAtIso) return null;
  return Math.max(0, Math.floor((nowMs + offsetMs - Date.parse(startedAtIso)) / 1000));
}

export function secondsUntil(deadlineIso: string | null, offsetMs: number, nowMs: number): number | null {
  if (!deadlineIso) return null;
  return Math.max(0, Math.ceil((Date.parse(deadlineIso) - (nowMs + offsetMs)) / 1000));
}

export function formatClock(totalSeconds: number | null): string {
  if (totalSeconds === null) return '--:--';
  const h = Math.floor(totalSeconds / 3600);
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}
