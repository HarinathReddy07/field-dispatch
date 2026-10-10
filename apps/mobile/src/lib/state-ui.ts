import type { RequestState, Role } from '@dispatch/contracts';
import { roleHeadline } from '@dispatch/ui-tokens';

export type Tone = 'neutral' | 'info' | 'warn' | 'good' | 'bad';

export interface StateUi {
  label: string;
  tone: Tone;
  /** Short sentence telling THIS role what is going on / what to do next. */
  headline: string;
}

const TONES: Record<RequestState, Tone> = {
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

const LABELS: Record<RequestState, string> = {
  DRAFT: 'Draft',
  REQUESTED: 'Requested',
  MATCHED: 'Choose a technician',
  CONFIRMED: 'Technician booked',
  ARRIVED: 'Technician on site',
  IN_PROGRESS: 'Inspection in progress',
  PROOF_UPLOADED: 'Evidence submitted',
  UNDER_REVIEW: 'Awaiting review',
  REWORK: 'Rework requested',
  COMPLETED: 'Completed',
  SETTLED: 'Settled',
  CANCELLED: 'Cancelled',
};

export function stateUi(role: Role, state: RequestState): StateUi {
  return { label: LABELS[state], tone: TONES[state], headline: roleHeadline(role, state) ?? LABELS[state] };
}

// Guidance and per-role actions are shared with the web portals (one source of truth).
export {
  jobActionsFor as actionsFor,
  isFinishedState as isFinished,
  type JobAction,
} from '@dispatch/ui-tokens';
