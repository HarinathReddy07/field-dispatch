import type { Category, RequestState, Role } from '@dispatch/contracts';

/** Where a job opens for this role. Requests still looking for a technician open the technician list. */
export function jobHref(role: Role, job: { id: string; state: RequestState }): string {
  if (role === 'TECHNICIAN') return `/tech/jobs/${job.id}`;
  if (role === 'REQUESTER')
    return job.state === 'REQUESTED' || job.state === 'MATCHED'
      ? `/app/requests/${job.id}/technicians`
      : `/app/requests/${job.id}`;
  return `/admin/jobs/${job.id}`;
}

/** Plain-language label for the main button on a job card, or `null` when there is nothing to do. */
export function nextStepLabel(role: Role, state: RequestState): string | null {
  if (role === 'REQUESTER') {
    switch (state) {
      case 'REQUESTED':
      case 'MATCHED':
        return 'Choose a technician';
      case 'CONFIRMED':
        return 'Show my code';
      case 'UNDER_REVIEW':
        return 'Review the work';
      default:
        return null;
    }
  }
  if (role === 'TECHNICIAN') {
    switch (state) {
      case 'CONFIRMED':
        return 'Enter arrival code';
      case 'ARRIVED':
        return 'Start work';
      case 'IN_PROGRESS':
      case 'REWORK':
        return 'Add photos';
      default:
        return null;
    }
  }
  return null;
}

export const CATEGORY_OPTIONS: readonly Category[] = ['ELECTRICAL_INSPECTION', 'MECHANICAL_INSPECTION'];

/** Rough arrival estimate for display only (assumes 25 km/h urban speed). */
export function etaMinutes(distanceKm: number): number {
  return Math.max(1, Math.round((distanceKm / 25) * 60));
}

/** Seconds from the server's "now" until `iso`, or `null`. The server clock is the reference, never the device clock. */
export function secondsUntilServer(
  iso: string | null,
  serverTime: string,
  fetchedAtMs: number,
  nowMs: number,
): number | null {
  if (!iso) return null;
  const serverNow = Date.parse(serverTime) + (nowMs - fetchedAtMs);
  return Math.max(0, Math.ceil((Date.parse(iso) - serverNow) / 1000));
}

/** mm:ss, or h:mm:ss from an hour up. */
export function clock(totalSeconds: number | null): string {
  if (totalSeconds === null) return '--:--';
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
