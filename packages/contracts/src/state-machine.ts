import { RequestState, Role } from './enums';

export type TransitionAction =
  | 'SUBMIT'
  | 'EDIT'
  | 'SEARCH'
  | 'CONFIRM'
  | 'CANCEL_ASSIGNMENT'
  | 'ARRIVE'
  | 'START'
  | 'STOP'
  | 'SUBMIT_REVIEW'
  | 'APPROVE'
  | 'AUTO_APPROVE'
  | 'REQUEST_REWORK'
  | 'SETTLE'
  | 'CANCEL'
  | 'ADMIN_REASSIGN'
  | 'ADMIN_CANCEL';

export type Actor = Role | 'SYSTEM';

export interface TransitionRule {
  from: RequestState;
  to: RequestState;
  action: TransitionAction;
  actors: readonly Actor[];
  /** A non-empty reason is mandatory for this transition. */
  reasonRequired?: boolean;
  /** Marks explicit admin override rows. */
  override?: boolean;
}

const rule = (
  from: RequestState,
  to: RequestState,
  action: TransitionAction,
  actors: readonly Actor[],
  extra: Partial<Pick<TransitionRule, 'reasonRequired' | 'override'>> = {},
): TransitionRule => ({ from, to, action, actors, ...extra });

const adminCancel = (from: RequestState) =>
  rule(from, 'CANCELLED', 'ADMIN_CANCEL', ['ADMIN'], { reasonRequired: true, override: true });
const adminReassign = (from: RequestState) =>
  rule(from, 'CONFIRMED', 'ADMIN_REASSIGN', ['ADMIN'], { reasonRequired: true, override: true });

/**
 * The single transition table (BUILD_SPEC section 2). Anything not listed is illegal
 * (409 ILLEGAL_TRANSITION). Guards and side effects are documented in docs/architecture.md.
 *
 *   DRAFT -submit-> REQUESTED -edit-> DRAFT          REQUESTED -nearest tech-> MATCHED -confirm-> CONFIRMED
 *   CONFIRMED -cancel-> REQUESTED                    CONFIRMED -OTP-> ARRIVED -start-> IN_PROGRESS
 *   IN_PROGRESS|REWORK -(>=2 proofs)-> PROOF_UPLOADED -> UNDER_REVIEW
 *   UNDER_REVIEW -approve|timeout-> COMPLETED -settlement-> SETTLED     UNDER_REVIEW -rework-> REWORK
 *
 * Assumption (docs/architecture.md): CANCELLED is an added terminal state for requester cancel before a
 * booking exists and for admin cancel; the spec's diagram has no terminal for those cases.
 */
export const TRANSITIONS: readonly TransitionRule[] = [
  rule('DRAFT', 'REQUESTED', 'SUBMIT', ['REQUESTER']),
  rule('REQUESTED', 'DRAFT', 'EDIT', ['REQUESTER']),
  rule('REQUESTED', 'MATCHED', 'SEARCH', ['REQUESTER']),
  rule('MATCHED', 'CONFIRMED', 'CONFIRM', ['REQUESTER']),
  rule('CONFIRMED', 'REQUESTED', 'CANCEL_ASSIGNMENT', ['REQUESTER']),
  rule('CONFIRMED', 'ARRIVED', 'ARRIVE', ['TECHNICIAN']),
  rule('ARRIVED', 'IN_PROGRESS', 'START', ['TECHNICIAN']),
  rule('IN_PROGRESS', 'PROOF_UPLOADED', 'STOP', ['TECHNICIAN']),
  rule('REWORK', 'PROOF_UPLOADED', 'STOP', ['TECHNICIAN']),
  rule('PROOF_UPLOADED', 'UNDER_REVIEW', 'SUBMIT_REVIEW', ['TECHNICIAN', 'SYSTEM']),
  rule('UNDER_REVIEW', 'COMPLETED', 'APPROVE', ['REQUESTER']),
  rule('UNDER_REVIEW', 'COMPLETED', 'AUTO_APPROVE', ['SYSTEM']),
  rule('UNDER_REVIEW', 'REWORK', 'REQUEST_REWORK', ['REQUESTER'], { reasonRequired: true }),
  rule('COMPLETED', 'SETTLED', 'SETTLE', ['SYSTEM']),
  rule('DRAFT', 'CANCELLED', 'CANCEL', ['REQUESTER']),
  rule('REQUESTED', 'CANCELLED', 'CANCEL', ['REQUESTER']),
  rule('MATCHED', 'CANCELLED', 'CANCEL', ['REQUESTER']),
  ...(
    [
      'DRAFT',
      'REQUESTED',
      'MATCHED',
      'CONFIRMED',
      'ARRIVED',
      'IN_PROGRESS',
      'PROOF_UPLOADED',
      'UNDER_REVIEW',
      'REWORK',
    ] as const
  ).map(adminCancel),
  ...(['CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'REWORK'] as const).map(adminReassign),
];

export type TransitionFailure = 'ILLEGAL_TRANSITION' | 'FORBIDDEN_ACTOR' | 'REASON_REQUIRED';

export type TransitionResult = { ok: true; rule: TransitionRule } | { ok: false; error: TransitionFailure };

export function evaluateTransition(
  from: RequestState,
  action: TransitionAction,
  actor: Actor,
  reason?: string | null,
): TransitionResult {
  const found = TRANSITIONS.find((t) => t.from === from && t.action === action);
  if (!found) return { ok: false, error: 'ILLEGAL_TRANSITION' };
  if (!found.actors.includes(actor)) return { ok: false, error: 'FORBIDDEN_ACTOR' };
  if (found.reasonRequired && !(reason && reason.trim().length > 0))
    return { ok: false, error: 'REASON_REQUIRED' };
  return { ok: true, rule: found };
}

/** States in which a technician is reserved by the request. */
export const ACTIVE_JOB_STATES: readonly RequestState[] = [
  'CONFIRMED',
  'ARRIVED',
  'IN_PROGRESS',
  'PROOF_UPLOADED',
  'UNDER_REVIEW',
  'REWORK',
];
