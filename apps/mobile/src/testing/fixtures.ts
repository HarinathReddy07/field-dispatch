import type { RequestView } from '@dispatch/contracts';
import type { LiveRequest } from '../api/hooks';
import { useSession } from '../state/session';

/** Test-only builders shared by the screen component tests. */
export const job = (over: Partial<LiveRequest> = {}): LiveRequest =>
  ({
    id: 'r1',
    assetId: 'PANEL-42',
    category: 'ELECTRICAL_INSPECTION',
    location: { lat: 12.9748, lon: 77.6033 },
    windowStart: '2030-01-01T10:00:00Z',
    windowEnd: '2030-01-01T12:00:00Z',
    notes: null,
    state: 'CONFIRMED',
    version: 3,
    workCycle: 1,
    quoteMinor: 52500,
    startedAt: null,
    reviewDeadlineAt: null,
    updatedAt: '2030-01-01T10:00:00Z',
    technician: { id: 't1', name: 'Anil', rating: 4.8, assignmentId: 'asg-7f3a' },
    settlement: null,
    serverTime: '2030-01-01T10:00:00Z',
    offsetMs: 0,
    ...over,
  }) as LiveRequest;

export const historyItem = (over: Partial<RequestView> = {}): RequestView =>
  ({ ...job(), state: 'SETTLED', ...over }) as RequestView;

/** The shape of a TanStack Query result as the screens consume it. */
export const query = (over: Record<string, unknown> = {}) => ({
  isPending: false,
  isError: false,
  isRefetching: false,
  data: undefined,
  error: null,
  refetch: jest.fn(),
  ...over,
});

/** The shape of a TanStack mutation result as the screens consume it. */
export const mutation = (over: Record<string, unknown> = {}) => ({
  mutateAsync: jest.fn(async () => ({})),
  isPending: false,
  isError: false,
  error: null,
  data: undefined,
  variables: undefined,
  ...over,
});

export const makeNavigation = () => ({
  navigate: jest.fn(),
  replace: jest.fn(),
  popToTop: jest.fn(),
});

export const signInAs = (role: 'REQUESTER' | 'TECHNICIAN' | 'ADMIN') =>
  useSession.setState({ status: 'authed', user: { id: 'u1', name: 'Test User', role } });
