import type { EventEnvelope, RequestState } from '@dispatch/contracts';
import { formatMoney } from '@dispatch/ui-tokens';

const STEP_TEXT: Record<RequestState, string> = {
  DRAFT: 'Request edited',
  REQUESTED: 'Request submitted',
  MATCHED: 'Nearby technicians found',
  CONFIRMED: 'Technician booked',
  ARRIVED: 'Technician arrived and the code was verified',
  IN_PROGRESS: 'Work started',
  PROOF_UPLOADED: 'Evidence submitted',
  UNDER_REVIEW: 'Sent for review',
  REWORK: 'Rework requested',
  COMPLETED: 'Work approved',
  SETTLED: 'Job completed',
  CANCELLED: 'Cancelled',
};

export interface TimelineEntry {
  key: string;
  at: string;
  text: string;
  /** A reason is shown quoted and italic; plain detail (an amount) is shown as is. */
  detail?: string;
  detailKind?: 'reason' | 'plain';
  state?: RequestState;
  /** Internal: how many photos this entry stands for, and a standalone rework-reason awaiting a merge. */
  photos?: number;
  reasonOnly?: boolean;
}

const photoText = (n: number) => (n === 1 ? 'A photo was added' : `${n} photos were added`);

/**
 * Turns the events a user is allowed to see into a readable history: consecutive photo uploads become one line,
 * and a rework reason is attached to the "Rework requested" step instead of repeating it.
 */
export function toEntries(events: EventEnvelope[]): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  const seen = new Set<string>();
  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    if (seen.has(e.eventId)) continue;
    seen.add(e.eventId);
    const d = e.data as Record<string, unknown>;
    const base = { key: e.eventId, at: e.occurredAt };
    switch (e.type) {
      case 'request.created':
        out.push({ ...base, text: 'Request created' });
        break;
      case 'request.state.changed': {
        const to = d.to as RequestState;
        if (to === 'MATCHED') break; // searching is not a milestone worth listing
        out.push({ ...base, text: STEP_TEXT[to] ?? 'Status updated', state: to });
        break;
      }
      case 'evidence.uploaded': {
        const last = out[out.length - 1];
        if (last?.photos) {
          last.photos += 1;
          last.text = photoText(last.photos);
          last.at = e.occurredAt;
        } else out.push({ ...base, text: photoText(1), photos: 1 });
        break;
      }
      case 'review.requested':
        out.push({
          ...base,
          text: 'Rework requested',
          detail: typeof d.reason === 'string' ? d.reason : undefined,
          detailKind: 'reason',
          reasonOnly: true,
        });
        break;
      case 'settlement.created':
        out.push({
          ...base,
          text: 'Payment recorded',
          detail: typeof d.amountMinor === 'number' ? formatMoney(d.amountMinor) : undefined,
          detailKind: 'plain',
        });
        break;
      case 'admin.override':
        out.push({
          ...base,
          text: d.action === 'CANCEL' ? 'Cancelled by operations' : 'Technician changed by operations',
          detail: typeof d.reason === 'string' ? d.reason : undefined,
          detailKind: 'reason',
        });
        break;
      default:
        break; // assignment.created and location updates are covered by the milestones above
    }
  }

  // The rework reason arrives as its own event next to the REWORK status change: show them as one step.
  for (let i = out.length - 1; i >= 0; i--) {
    const entry = out[i]!;
    if (!entry.reasonOnly) continue;
    const mate = [out[i - 1], out[i + 1]].find((n) => n?.state === 'REWORK' && !n.detail);
    if (mate) {
      mate.detail = entry.detail;
      mate.detailKind = 'reason';
      out.splice(i, 1);
    }
  }
  return out;
}
