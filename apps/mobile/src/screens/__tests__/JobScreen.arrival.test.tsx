import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '../../api/client';
import {
  type JobHooks,
  makeNavigation,
  mutation,
  query,
  resetJobHooks,
  showJob,
} from '../../testing/jobScreen';
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

describe('arrival: requester shows the code', () => {
  it('offers the code only to the requester, only while the technician is booked', async () => {
    showJob(hooks, 'REQUESTER');
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Share the arrival code when the technician is at your site.')).toBeTruthy();
    expect(screen.getByLabelText('Show arrival code')).toBeTruthy();
    expect(screen.queryByLabelText('Confirm arrival')).toBeNull(); // technician control
    expect(screen.queryByLabelText('Arrival code')).toBeNull();
  });

  it('displays the server-issued code with its expiry (the code is never derived on the device)', async () => {
    showJob(hooks, 'REQUESTER');
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const issue = mutation({ mutateAsync: jest.fn(async () => ({ otp: '482915', expiresAt })) });
    hooks.useIssueOtp.mockReturnValue({ ...issue, data: { otp: '482915', expiresAt } });
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('482915')).toBeTruthy();
    expect(screen.getByLabelText('Arrival code 4 8 2 9 1 5')).toBeTruthy();
    expect(screen.getByText(/Expires in \d\d:\d\d/)).toBeTruthy();
    expect(screen.getByLabelText('Get a new code')).toBeTruthy();
  });

  it('asks the server for a code when tapped and surfaces a failure safely', async () => {
    showJob(hooks, 'REQUESTER');
    const issue = mutation();
    hooks.useIssueOtp.mockReturnValue(issue);
    const { rerender } = await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    await fireEvent.press(screen.getByLabelText('Show arrival code'));
    expect(issue.mutateAsync).toHaveBeenCalledTimes(1);

    hooks.useIssueOtp.mockReturnValue(
      mutation({ isError: true, error: new ApiError(409, 'STATE_CONFLICT', 'Not allowed right now') }),
    );
    await rerender(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Not allowed right now')).toBeTruthy();
  });
});

describe('arrival: technician enters the code', () => {
  it('shows the entry box to the technician, never the code or the requester control', async () => {
    showJob(hooks, 'TECHNICIAN');
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Head to the site, then enter the customer’s arrival code.')).toBeTruthy();
    expect(screen.getByLabelText('Arrival code')).toBeTruthy();
    expect(screen.getByLabelText('Confirm arrival')).toBeTruthy();
    expect(screen.queryByLabelText('Show arrival code')).toBeNull();
    expect(screen.queryByLabelText('Release technician')).toBeNull(); // cancel/release is requester-only
  });

  it('accepts digits only and blocks submission until six digits are entered', async () => {
    showJob(hooks, 'TECHNICIAN');
    const arrive = mutation();
    hooks.useArrive.mockReturnValue(arrive);
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    await fireEvent.changeText(screen.getByLabelText('Arrival code'), '12ab3');
    expect(screen.getByLabelText('Arrival code').props.value).toBe('123');
    await fireEvent.press(screen.getByLabelText('Confirm arrival'));
    expect(screen.getByText('Enter the 6-digit code.')).toBeTruthy();
    expect(arrive.mutateAsync).not.toHaveBeenCalled();
  });

  it('submits the six digits to the server', async () => {
    showJob(hooks, 'TECHNICIAN');
    const arrive = mutation();
    hooks.useArrive.mockReturnValue(arrive);
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    await fireEvent.changeText(screen.getByLabelText('Arrival code'), '482915');
    await fireEvent.press(screen.getByLabelText('Confirm arrival'));
    await waitFor(() => expect(arrive.mutateAsync).toHaveBeenCalledWith('482915'));
  });

  it('wrong, expired and already-used codes all get the same safe message', async () => {
    showJob(hooks, 'TECHNICIAN');
    // The server answers all three identically (OTP_INVALID); the app must not add detail.
    const arrive = mutation({
      mutateAsync: jest.fn(async () => {
        throw new ApiError(400, 'OTP_INVALID', 'Invalid or expired code');
      }),
    });
    hooks.useArrive.mockReturnValue(arrive);
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    await fireEvent.changeText(screen.getByLabelText('Arrival code'), '000000');
    await fireEvent.press(screen.getByLabelText('Confirm arrival'));
    const msg = await screen.findByText('That code is not valid. Ask the customer for a new one.');
    expect(msg).toBeTruthy();
    expect(screen.queryByText(/expired|already used|wrong/i)).toBeNull();
  });

  it('tells the technician to wait when the server locks further attempts', async () => {
    showJob(hooks, 'TECHNICIAN');
    hooks.useArrive.mockReturnValue(
      mutation({
        mutateAsync: jest.fn(async () => {
          throw new ApiError(429, 'OTP_LOCKED', 'Too many attempts. Try again later');
        }),
      }),
    );
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    await fireEvent.changeText(screen.getByLabelText('Arrival code'), '111111');
    await fireEvent.press(screen.getByLabelText('Confirm arrival'));
    expect(await screen.findByText('Too many attempts. Wait a few minutes, then try again.')).toBeTruthy();
  });

  it('reassures the technician when the device is offline (the code is kept for a retry)', async () => {
    showJob(hooks, 'TECHNICIAN');
    hooks.useArrive.mockReturnValue(
      mutation({
        mutateAsync: jest.fn(async () => {
          throw new ApiError(0, 'NETWORK', 'fetch failed');
        }),
      }),
    );
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    await fireEvent.changeText(screen.getByLabelText('Arrival code'), '222222');
    await fireEvent.press(screen.getByLabelText('Confirm arrival'));
    expect(
      await screen.findByText('No connection. Your code was not lost: tap again to retry.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Arrival code').props.value).toBe('222222');
  });
});

describe('job screen states', () => {
  it('shows loading, a retryable error, and a calm "no longer available" for a 404', async () => {
    hooks.useRequest.mockReturnValue(query({ isPending: true }));
    const { rerender } = await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByLabelText('Loading…')).toBeTruthy();

    const refetch = jest.fn();
    hooks.useRequest.mockReturnValue(
      query({ isError: true, error: new ApiError(500, 'INTERNAL', 'Internal server error'), refetch }),
    );
    await rerender(<JobScreen navigation={makeNavigation() as never} route={route} />);
    await fireEvent.press(screen.getByLabelText('Retry'));
    expect(refetch).toHaveBeenCalled();

    const navigation = makeNavigation();
    hooks.useRequest.mockReturnValue(
      query({ isError: true, error: new ApiError(404, 'NOT_FOUND', 'Resource not found') }),
    );
    await rerender(<JobScreen navigation={navigation as never} route={route} />);
    expect(screen.getByText('This job is no longer available')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Back to jobs'));
    expect(navigation.popToTop).toHaveBeenCalled();
  });
});
