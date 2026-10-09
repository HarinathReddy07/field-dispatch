import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError } from '../../api/client';
import { type JobHooks, makeNavigation, mutation, resetJobHooks, showJob } from '../../testing/jobScreen';
import { JobScreen } from '../JobScreen';

jest.mock('../../api/hooks', () => ({
  useRequest: jest.fn(),
  useIssueOtp: jest.fn(),
  useArrive: jest.fn(),
  useStart: jest.fn(),
  useStop: jest.fn(),
  useReview: jest.fn(),
  useCancel: jest.fn(),
  useEvidence: jest.fn(),
  pingLocation: jest.fn(),
}));
jest.mock('../../realtime/live', () => ({ useRequestRoom: jest.fn() }));
jest.mock('../../evidence/useUploads', () => ({
  useUploads: () => ({ items: [], add: jest.fn(), retry: jest.fn() }),
}));
jest.mock('expo-image-picker', () => ({}));
// A fixed DEVICE clock one hour ahead of the server: the timer must follow the server, not the device.
const SERVER_NOW = Date.parse('2030-01-01T10:10:00Z');
const DEVICE_NOW = SERVER_NOW + 3_600_000;
jest.mock('../../lib/useNow', () => ({ useNow: () => Date.parse('2030-01-01T10:10:00Z') + 3_600_000 }));
jest.mock('../../api/instance', () => ({
  api: { hasSession: async () => false, get: jest.fn(), login: jest.fn(), logout: jest.fn() },
  uuid: () => 'uuid',
  setOnSessionExpired: jest.fn(),
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const hooks = require('../../api/hooks') as JobHooks;
const route = { key: 'k', name: 'Job', params: { requestId: 'r1' } } as never;

afterEach(async () => {
  await cleanup();
});
beforeEach(() => resetJobHooks(hooks));

describe('active job: server-driven timer', () => {
  const working = {
    state: 'IN_PROGRESS' as const,
    startedAt: new Date(SERVER_NOW - 125_000).toISOString(), // started 2 min 5 s ago, SERVER time
    offsetMs: SERVER_NOW - DEVICE_NOW, // what the app learned from the server's clock
  };

  it('shows elapsed time from the server start timestamp even when the device clock is wrong', async () => {
    showJob(hooks, 'TECHNICIAN', working);
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Work timer')).toBeTruthy();
    expect(screen.getByLabelText('Elapsed 02:05')).toBeTruthy(); // not 1:02:05, which a naive device clock would show
  });

  it('shows the same elapsed time to the requester, read-only', async () => {
    showJob(hooks, 'REQUESTER', working);
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByLabelText('Elapsed 02:05')).toBeTruthy();
    expect(screen.getByText('The technician is inspecting your asset.')).toBeTruthy();
    expect(screen.queryByLabelText('Start inspection')).toBeNull();
    expect(screen.queryByLabelText('Finish and submit for review')).toBeNull();
  });

  it('has no timer before the server has recorded a start', async () => {
    showJob(hooks, 'TECHNICIAN', { state: 'ARRIVED', startedAt: null });
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.queryByText('Work timer')).toBeNull();
  });
});

describe('active job: role-specific controls', () => {
  it('technician on site: only "Start inspection", which asks the server to start', async () => {
    showJob(hooks, 'TECHNICIAN', { state: 'ARRIVED' });
    const start = mutation();
    hooks.useStart.mockReturnValue(start);
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Start the inspection when you are ready.')).toBeTruthy();
    expect(screen.queryByLabelText('Show arrival code')).toBeNull();
    expect(screen.queryByLabelText('Approve')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Start inspection'));
    expect(start.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('shows the server refusal when starting is not allowed', async () => {
    showJob(hooks, 'TECHNICIAN', { state: 'ARRIVED' });
    hooks.useStart.mockReturnValue(
      mutation({ isError: true, error: new ApiError(409, 'ILLEGAL_TRANSITION', 'Illegal state transition') }),
    );
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Illegal state transition')).toBeTruthy();
  });

  it('technician sees the assignment (site, notes, quote) and navigation; requester sees live location instead', async () => {
    showJob(hooks, 'TECHNICIAN', { state: 'CONFIRMED', notes: 'Gate code 1234' });
    const { rerender } = await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Assignment')).toBeTruthy();
    expect(screen.getByText('Gate code 1234')).toBeTruthy();
    expect(screen.getByLabelText('Navigate to site')).toBeTruthy();
    expect(screen.queryByText('Technician location')).toBeNull();

    showJob(hooks, 'REQUESTER', { state: 'CONFIRMED' });
    await rerender(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Technician location')).toBeTruthy();
    expect(screen.getByText('Waiting for the technician’s position…')).toBeTruthy();
    expect(screen.queryByText('Assignment')).toBeNull();
    expect(screen.queryByLabelText('Navigate to site')).toBeNull();
  });

  it('requester can release a booked technician; the technician cannot cancel', async () => {
    showJob(hooks, 'REQUESTER', { state: 'CONFIRMED' });
    const { rerender } = await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByLabelText('Release technician')).toBeTruthy();

    showJob(hooks, 'TECHNICIAN', { state: 'CONFIRMED' });
    await rerender(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.queryByLabelText('Release technician')).toBeNull();
    expect(screen.queryByLabelText('Cancel request')).toBeNull();
  });

  it('finished jobs offer the receipt and no working controls', async () => {
    showJob(hooks, 'REQUESTER', { state: 'SETTLED' });
    const navigation = makeNavigation();
    await render(<JobScreen navigation={navigation as never} route={route} />);
    await fireEvent.press(screen.getByLabelText('View receipt'));
    expect(navigation.navigate).toHaveBeenCalledWith('Receipt', { requestId: 'r1' });
    expect(screen.queryByLabelText('Release technician')).toBeNull();
    expect(screen.queryByLabelText('Technician location')).toBeNull();
  });

  it('a request that has no technician yet sends the requester to the search', async () => {
    showJob(hooks, 'REQUESTER', { state: 'REQUESTED', technician: null });
    const navigation = makeNavigation();
    await render(<JobScreen navigation={navigation as never} route={route} />);
    await fireEvent.press(screen.getByLabelText('Find technicians'));
    expect(navigation.navigate).toHaveBeenCalledWith('Nearby', { requestId: 'r1' });
  });
});
