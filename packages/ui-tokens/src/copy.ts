import type { RequestState, Role } from '@dispatch/contracts';

/**
 * Role-aware guidance shared by the web portals and the mobile app, so a requester or technician reads the same
 * words and is offered the same next step on every client. Purely presentational: the server decides legality.
 */
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
    SETTLED: 'All done. Your receipt is ready.',
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

/** One sentence telling this role what is going on and what to do next, or `undefined` when there is nothing to add. */
export function roleHeadline(role: Role, state: RequestState): string | undefined {
  return HEADLINES[role][state];
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

/** Which controls a job screen offers for (role, state). */
export function jobActionsFor(role: Role, state: RequestState): JobAction[] {
  if (role === 'REQUESTER') {
    switch (state) {
      case 'REQUESTED':
        return ['FIND_TECHNICIAN', 'CANCEL'];
      case 'MATCHED':
        return ['PICK_TECHNICIAN', 'CANCEL'];
      case 'CONFIRMED':
        return ['SHOW_OTP', 'CANCEL'];
      case 'UNDER_REVIEW':
        return ['REVIEW'];
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

/** Terminal for the user: nothing more can happen to the request. */
export const isFinishedState = (s: RequestState): boolean =>
  s === 'SETTLED' || s === 'COMPLETED' || s === 'CANCELLED';

/** The product's categories in plain words, with the icon-free label used on every client. */
export const CATEGORY_LABEL: Record<string, string> = {
  ELECTRICAL_INSPECTION: 'Electrical inspection',
  MECHANICAL_INSPECTION: 'Mechanical inspection',
};

export const categoryLabel = (category: string): string =>
  CATEGORY_LABEL[category] ?? category.replace(/_/g, ' ').toLowerCase();
