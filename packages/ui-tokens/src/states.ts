import type { RequestState } from '@dispatch/contracts';
import type { ThemeName } from './colors';

export interface StateStyle {
  label: string;
  light: { bg: string; text: string };
  dark: { bg: string; text: string };
}

/**
 * Typed against the contract's RequestState: adding a state to @dispatch/contracts is a compile error here.
 * The design plan's names map onto the backend machine (BUILD_SPEC section 2, ADR 0006):
 * CREATED = DRAFT, MATCHING = REQUESTED/MATCHED, ASSIGNED = CONFIRMED, REWORK_REQUESTED = REWORK,
 * COMPLETED = COMPLETED/SETTLED.
 */
const created = { light: { bg: '#F1F5F9', text: '#334155' }, dark: { bg: '#1E293B', text: '#CBD5E1' } };
const matching = { light: { bg: '#DBEAFE', text: '#1E40AF' }, dark: { bg: '#172554', text: '#BFDBFE' } };
const completed = { light: { bg: '#DCFCE7', text: '#166534' }, dark: { bg: '#052E16', text: '#BBF7D0' } };
const working = { light: { bg: '#FEF3C7', text: '#92400E' }, dark: { bg: '#451A03', text: '#FDE68A' } };

export const stateStyles: Record<RequestState, StateStyle> = {
  DRAFT: { label: 'Created', ...created },
  REQUESTED: { label: 'Finding technician', ...matching },
  MATCHED: { label: 'Choose technician', ...matching },
  CONFIRMED: {
    label: 'Assigned',
    light: { bg: '#E0E7FF', text: '#3730A3' },
    dark: { bg: '#1E1B4B', text: '#C7D2FE' },
  },
  ARRIVED: {
    label: 'On site',
    light: { bg: '#CFFAFE', text: '#155E75' },
    dark: { bg: '#083344', text: '#A5F3FC' },
  },
  IN_PROGRESS: { label: 'In progress', ...working },
  PROOF_UPLOADED: { label: 'Evidence submitted', ...working },
  UNDER_REVIEW: {
    label: 'Awaiting review',
    light: { bg: '#EDE9FE', text: '#5B21B6' },
    dark: { bg: '#2E1065', text: '#DDD6FE' },
  },
  REWORK: {
    label: 'Rework requested',
    light: { bg: '#FFEDD5', text: '#9A3412' },
    dark: { bg: '#431407', text: '#FED7AA' },
  },
  COMPLETED: { label: 'Completed', ...completed },
  SETTLED: { label: 'Settled', ...completed },
  CANCELLED: {
    label: 'Cancelled',
    light: { bg: '#FEE2E2', text: '#991B1B' },
    dark: { bg: '#450A0A', text: '#FECACA' },
  },
};

/** Style for any state string (an unknown state from a newer server falls back to neutral). */
export function stateStyle(state: string, theme: ThemeName = 'light') {
  const s = (stateStyles as Record<string, StateStyle | undefined>)[state];
  return s
    ? { label: s.label, ...s[theme] }
    : { label: state.toLowerCase().replace(/_/g, ' '), ...created[theme] };
}

/** The six steps of the progress stepper. */
export const JOURNEY_STEPS = [
  { key: 'requested', label: 'Requested' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'onsite', label: 'On site' },
  { key: 'working', label: 'In progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
] as const;

export interface Journey {
  /** index of the current step; -1 for cancelled */
  current: number;
  /** extra note shown beside the stepper (rework / cancelled) */
  note: string | null;
}

export function journeyOf(state: RequestState | string): Journey {
  switch (state) {
    case 'DRAFT':
    case 'REQUESTED':
    case 'MATCHED':
      return { current: 0, note: null };
    case 'CONFIRMED':
      return { current: 1, note: null };
    case 'ARRIVED':
      return { current: 2, note: null };
    case 'IN_PROGRESS':
    case 'PROOF_UPLOADED':
      return { current: 3, note: null };
    case 'REWORK':
      return { current: 3, note: 'Rework requested' };
    case 'UNDER_REVIEW':
      return { current: 4, note: null };
    case 'COMPLETED':
    case 'SETTLED':
      return { current: 5, note: null };
    case 'CANCELLED':
      return { current: -1, note: 'Cancelled' };
    default:
      return { current: 0, note: null };
  }
}
