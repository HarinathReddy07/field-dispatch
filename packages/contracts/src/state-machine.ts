import { RequestState, Role } from './enums';

export type TransitionAction =
  | 'SEARCH'
  | 'CONFIRM'
  | 'ARRIVE'
  | 'START'
  | 'STOP'
  | 'APPROVE'
  | 'AUTO_APPROVE'
  | 'REQUEST_REWORK'
  | 'RESTART_WORK'
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

const cancel = (from: RequestState): TransitionRule => ({
  from,
  to: 'CANCELLED',
  action: 'CANCEL',
  actors: ['REQUESTER'],
});
const adminCancel = (from: RequestState): TransitionRule => ({
  from,
  to: 'CANCELLED',
  action: 'ADMIN_CANCEL',
  actors: ['ADMIN'],
  reasonRequired: true,
  override: true,
});
const adminReassign = (from: RequestState): TransitionRule => ({
  from,
  to: 'ASSIGNED',
  action: 'ADMIN_REASSIGN',
  actors: ['ADMIN'],
  reasonRequired: true,
  override: true,
});

/**
 * The single transition table. Anything not listed is illegal (409 ILLEGAL_TRANSITION).
 * Guards and side effects are documented in docs/architecture.md.
 */
export const TRANSITIONS: readonly TransitionRule[] = [
  { from: 'CREATED', to: 'MATCHING', action: 'SEARCH', actors: ['REQUESTER'] },
  { from: 'CREATED', to: 'ASSIGNED', action: 'CONFIRM', actors: ['REQUESTER'] },
  { from: 'MATCHING', to: 'ASSIGNED', action: 'CONFIRM', actors: ['REQUESTER'] },
  { from: 'ASSIGNED', to: 'ARRIVED', action: 'ARRIVE', actors: ['TECHNICIAN'] },
  { from: 'ARRIVED', to: 'IN_PROGRESS', action: 'START', actors: ['TECHNICIAN'] },
  { from: 'IN_PROGRESS', to: 'UNDER_REVIEW', action: 'STOP', actors: ['TECHNICIAN'] },
  { from: 'UNDER_REVIEW', to: 'COMPLETED', action: 'APPROVE', actors: ['REQUESTER'] },
  { from: 'UNDER_REVIEW', to: 'COMPLETED', action: 'AUTO_APPROVE', actors: ['SYSTEM'] },
  {
    from: 'UNDER_REVIEW',
    to: 'REWORK_REQUESTED',
    action: 'REQUEST_REWORK',
    actors: ['REQUESTER'],
    reasonRequired: true,
  },
  { from: 'REWORK_REQUESTED', to: 'IN_PROGRESS', action: 'RESTART_WORK', actors: ['TECHNICIAN'] },
  cancel('CREATED'),
  cancel('MATCHING'),
  cancel('ASSIGNED'),
  cancel('ARRIVED'),
  adminCancel('CREATED'),
  adminCancel('MATCHING'),
  adminCancel('ASSIGNED'),
  adminCancel('ARRIVED'),
  adminCancel('IN_PROGRESS'),
  adminCancel('UNDER_REVIEW'),
  adminCancel('REWORK_REQUESTED'),
  adminReassign('ASSIGNED'),
  adminReassign('ARRIVED'),
  adminReassign('IN_PROGRESS'),
  adminReassign('REWORK_REQUESTED'),
];

export type TransitionFailure = 'ILLEGAL_TRANSITION' | 'FORBIDDEN_ACTOR' | 'REASON_REQUIRED';

export type TransitionResult = { ok: true; rule: TransitionRule } | { ok: false; error: TransitionFailure };

export function evaluateTransition(
  from: RequestState,
  action: TransitionAction,
  actor: Actor,
  reason?: string | null,
): TransitionResult {
  const rule = TRANSITIONS.find((t) => t.from === from && t.action === action);
  if (!rule) return { ok: false, error: 'ILLEGAL_TRANSITION' };
  if (!rule.actors.includes(actor)) return { ok: false, error: 'FORBIDDEN_ACTOR' };
  if (rule.reasonRequired && !(reason && reason.trim().length > 0))
    return { ok: false, error: 'REASON_REQUIRED' };
  return { ok: true, rule };
}

/** States in which a technician is reserved by the request. */
export const ACTIVE_JOB_STATES: readonly RequestState[] = [
  'ASSIGNED',
  'ARRIVED',
  'IN_PROGRESS',
  'UNDER_REVIEW',
  'REWORK_REQUESTED',
];
