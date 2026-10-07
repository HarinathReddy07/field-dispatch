import type { RequestState, Role } from '@dispatch/contracts';

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

const HEADLINES: Record<Role, Partial<Record<RequestState, string>>> = {
  REQUESTER: {
    REQUESTED: 'Find a nearby technician to continue.',
    MATCHED: 'Pick one of the nearby technicians.',
    CONFIRMED: 'Share the arrival code when the technician is at your site.',
    ARRIVED: 'The technician has arrived. Work starts shortly.',
    IN_PROGRESS: 'The technician is inspecting your asset.',
    PROOF_UPLOADED: 'Evidence received. Preparing your review.',
    UNDER_REVIEW: 'Review the evidence and approve it or ask for rework.',
    REWORK: 'The technician is redoing the inspection.',
    SETTLED: 'All done. Your receipt is below.',
    CANCELLED: 'This request was cancelled.',
  },
  TECHNICIAN: {
    CONFIRMED: 'Head to the site, then enter the customer’s arrival code.',
    ARRIVED: 'Start the inspection when you are ready.',
    IN_PROGRESS: 'Upload at least two photos, then finish the job.',
    UNDER_REVIEW: 'Waiting for the customer to review your evidence.',
    REWORK: 'Upload new photos for the rework, then finish the job.',
    SETTLED: 'Job complete.',
    CANCELLED: 'This job was cancelled.',
  },
  ADMIN: {},
};

export function stateUi(role: Role, state: RequestState): StateUi {
  return { label: LABELS[state], tone: TONES[state], headline: HEADLINES[role][state] ?? LABELS[state] };
}

export type JobAction =
  | 'FIND_TECHNICIAN'
  | 'PICK_TECHNICIAN'
  | 'SHOW_OTP'
  | 'ENTER_OTP'
  | 'START'
  | 'UPLOAD_EVIDENCE'
  | 'FINISH'
  | 'REVIEW'
  | 'RECEIPT'
  | 'CANCEL';

/** Which controls the job screen offers for (role, state). Purely presentational: the server decides legality. */
export function actionsFor(role: Role, state: RequestState): JobAction[] {
  if (role === 'REQUESTER') {
    switch (state) {
      case 'REQUESTED':
        return ['FIND_TECHNICIAN', 'CANCEL'];
      case 'MATCHED':
        return ['PICK_TECHNICIAN', 'CANCEL'];
      case 'CONFIRMED':
        return ['SHOW_OTP', 'CANCEL'];
      case 'UNDER_REVIEW':
        return ['UPLOAD_EVIDENCE', 'REVIEW'].filter((a) => a === 'REVIEW') as JobAction[];
      case 'SETTLED':
      case 'COMPLETED':
        return ['RECEIPT'];
      default:
        return [];
    }
  }
  if (role === 'TECHNICIAN') {
    switch (state) {
      case 'CONFIRMED':
        return ['ENTER_OTP'];
      case 'ARRIVED':
        return ['START'];
      case 'IN_PROGRESS':
      case 'REWORK':
        return ['UPLOAD_EVIDENCE', 'FINISH'];
      case 'SETTLED':
      case 'COMPLETED':
        return ['RECEIPT'];
      default:
        return [];
    }
  }
  return [];
}

export const isFinished = (s: RequestState): boolean =>
  s === 'SETTLED' || s === 'COMPLETED' || s === 'CANCELLED';
