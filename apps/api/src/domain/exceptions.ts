import type { RequestState } from '@dispatch/contracts';

export type ExceptionFlag =
  'NO_TECHNICIAN' | 'TECHNICIAN_STALE' | 'REVIEW_OVERDUE' | 'REWORK_OPEN' | 'MULTIPLE_REWORKS';

export interface ExceptionInput {
  state: RequestState;
  workCycle: number;
  createdAt: Date;
  reviewDeadlineAt: Date | null;
  technicianLastSeenAt: Date | null;
  now: Date;
  freshnessSeconds: number;
  noTechnicianAfterSeconds?: number;
}

const FIELD_STATES: readonly RequestState[] = ['CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'REWORK'];

/** Server-defined exception flags shown on the admin board (clients never compute these). */
export function computeExceptionFlags(i: ExceptionInput): ExceptionFlag[] {
  const flags: ExceptionFlag[] = [];
  const now = i.now.getTime();
  if (
    (i.state === 'REQUESTED' || i.state === 'MATCHED') &&
    now - i.createdAt.getTime() > (i.noTechnicianAfterSeconds ?? 300) * 1000
  ) {
    flags.push('NO_TECHNICIAN');
  }
  if (FIELD_STATES.includes(i.state)) {
    const seen = i.technicianLastSeenAt?.getTime();
    if (seen === undefined || now - seen > i.freshnessSeconds * 1000) flags.push('TECHNICIAN_STALE');
  }
  if (i.state === 'UNDER_REVIEW' && i.reviewDeadlineAt && i.reviewDeadlineAt.getTime() < now - 30_000) {
    flags.push('REVIEW_OVERDUE'); // the sweeper should have completed it by now
  }
  if (i.state === 'REWORK') flags.push('REWORK_OPEN');
  if (i.workCycle >= 3 && i.state !== 'SETTLED' && i.state !== 'CANCELLED') flags.push('MULTIPLE_REWORKS');
  return flags;
}
