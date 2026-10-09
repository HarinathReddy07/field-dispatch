import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { RequestView } from '@dispatch/contracts';
import { ApiError } from '../../api/client';
import { HomeScreen } from '../HomeScreen';
import { useSession } from '../../state/session';
import { useUi } from '../../state/ui';

// The screens talk to the API only through these hooks; mock the module boundary, not the network.
jest.mock('../../api/hooks', () => ({
  useActive: jest.fn(),
  useAvailability: jest.fn(),
}));
jest.mock('../../api/instance', () => ({
  api: { hasSession: async () => false, get: jest.fn(), login: jest.fn(), logout: jest.fn() },
  uuid: () => 'uuid',
  setOnSessionExpired: jest.fn(),
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const hooks = require('../../api/hooks') as { useActive: jest.Mock; useAvailability: jest.Mock };

const job = (over: Partial<RequestView> = {}): RequestView =>
  ({
    id: 'r1',
    assetId: 'PANEL-42',
    category: 'ELECTRICAL_INSPECTION',
    location: { lat: 12.97, lon: 77.6 },
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
    technician: { id: 't', name: 'Anil', rating: 4.8, assignmentId: 'a' },
    settlement: null,
    serverTime: '2030-01-01T10:00:00Z',
    ...over,
  }) as RequestView;

const query = (over: Record<string, unknown>) => ({
  isPending: false,
  isError: false,
  isRefetching: false,
  data: [],
  error: null,
  refetch: jest.fn(),
  ...over,
});

const navigation = { navigate: jest.fn() } as never;
const route = { key: 'k', name: 'Home' } as never;

const signInAs = (role: 'REQUESTER' | 'TECHNICIAN') =>
  useSession.setState({ status: 'authed', user: { id: 'u1', name: 'Test', role } });

afterEach(async () => {
  await cleanup(); // unmount between tests so a pending handler from one test can't leak into the next
});

beforeEach(() => {
  jest.clearAllMocks();
  useUi.setState({ live: 'live' });
  hooks.useAvailability.mockReturnValue({
    mutateAsync: jest.fn(async () => ({ status: 'AVAILABLE' })),
    isPending: false,
    isError: false,
  });
});

describe('requester home', () => {
  beforeEach(() => signInAs('REQUESTER'));

  it('lists active requests with the backend state, and opens the right screen', async () => {
    hooks.useActive.mockReturnValue(
      query({ data: [job({ state: 'CONFIRMED' }), job({ id: 'r2', assetId: 'PUMP-1', state: 'MATCHED' })] }),
    );
    await render(<HomeScreen navigation={navigation} route={route} />);

    expect(screen.getByText('Your requests')).toBeTruthy();
    expect(screen.getByText('PANEL-42')).toBeTruthy();
    expect(screen.getByText('Assigned')).toBeTruthy();
    expect(screen.queryByText('Go online')).toBeNull(); // technician controls are not shown to a requester

    await fireEvent.press(screen.getByLabelText('PANEL-42, Assigned'));
    expect((navigation as { navigate: jest.Mock }).navigate).toHaveBeenCalledWith('Job', { requestId: 'r1' });
    await fireEvent.press(screen.getByLabelText('PUMP-1, Choose technician'));
    expect((navigation as { navigate: jest.Mock }).navigate).toHaveBeenCalledWith('Nearby', {
      requestId: 'r2',
    });
  });

  it('shows loading, empty and error states', async () => {
    hooks.useActive.mockReturnValue(query({ isPending: true, data: undefined }));
    const { rerender } = await render(<HomeScreen navigation={navigation} route={route} />);
    expect(screen.getByLabelText('Loading…')).toBeTruthy();

    hooks.useActive.mockReturnValue(query({ data: [] }));
    await rerender(<HomeScreen navigation={navigation} route={route} />);
    expect(screen.getByText('No active requests')).toBeTruthy();

    const refetch = jest.fn();
    hooks.useActive.mockReturnValue(
      query({ isError: true, data: undefined, error: new ApiError(0, 'NETWORK', 'x'), refetch }),
    );
    await rerender(<HomeScreen navigation={navigation} route={route} />);
    expect(screen.getByText('You appear to be offline.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Retry'));
    expect(refetch).toHaveBeenCalled();
  });

  it('shows an offline banner while the live connection is down', async () => {
    useUi.setState({ live: 'offline' });
    hooks.useActive.mockReturnValue(query({ data: [] }));
    await render(<HomeScreen navigation={navigation} route={route} />);
    expect(screen.getByText(/Offline: showing the last known data/)).toBeTruthy();
  });

  it('new request button navigates', async () => {
    hooks.useActive.mockReturnValue(query({ data: [] }));
    await render(<HomeScreen navigation={navigation} route={route} />);
    await fireEvent.press(screen.getByLabelText('New request'));
    expect((navigation as { navigate: jest.Mock }).navigate).toHaveBeenCalledWith('CreateRequest');
  });
});

describe('technician home', () => {
  beforeEach(() => signInAs('TECHNICIAN'));

  it('shows availability controls and the active assignment', async () => {
    hooks.useActive.mockReturnValue(query({ data: [job({ state: 'ARRIVED' })] }));
    await render(<HomeScreen navigation={navigation} route={route} />);
    expect(screen.getByText('Your jobs')).toBeTruthy();
    expect(screen.getByText('Busy with a job')).toBeTruthy();
    expect(screen.getByText('On site')).toBeTruthy();
    expect(screen.queryByLabelText('New request')).toBeNull(); // requester controls are not shown to a technician
    await fireEvent.press(screen.getByLabelText('PANEL-42, On site'));
    expect((navigation as { navigate: jest.Mock }).navigate).toHaveBeenCalledWith('Job', { requestId: 'r1' });
  });

  it('shows the server error when availability cannot be changed', async () => {
    hooks.useActive.mockReturnValue(query({ data: [] }));
    hooks.useAvailability.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
      isError: true,
      error: new ApiError(409, 'STATE_CONFLICT', 'Availability cannot be changed during an active job'),
    });
    await render(<HomeScreen navigation={navigation} route={route} />);
    expect(screen.getByText('Availability cannot be changed during an active job')).toBeTruthy();
  });

  // Keep this one last: it leaves a deliberately pending handler.
  it('idle technician can go online; a double tap fires the mutation only once', async () => {
    hooks.useActive.mockReturnValue(query({ data: [] }));
    let resolve!: () => void;
    const mutateAsync = jest.fn(
      () => new Promise<{ status: string }>((r) => (resolve = () => r({ status: 'AVAILABLE' }))),
    );
    hooks.useAvailability.mockReturnValue({ mutateAsync, isPending: false, isError: false });
    await render(<HomeScreen navigation={navigation} route={route} />);

    expect(screen.getByText('No assignment right now')).toBeTruthy();
    const goOnline = screen.getByLabelText('Go online');
    const first = fireEvent.press(goOnline); // the handler stays pending until we resolve it
    const second = fireEvent.press(goOnline); // nervous double tap
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    resolve();
    await Promise.all([first, second]);
    await waitFor(() => expect(screen.getByText('Online: you can be booked')).toBeTruthy());
  });
});
