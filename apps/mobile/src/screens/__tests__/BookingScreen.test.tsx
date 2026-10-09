import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError } from '../../api/client';
import { job, makeNavigation, query } from '../../testing/fixtures';
import { BookingScreen } from '../BookingScreen';

jest.mock('../../api/hooks', () => ({ useRequest: jest.fn() }));
jest.mock('../../api/instance', () => ({
  api: { hasSession: async () => false, get: jest.fn(), login: jest.fn(), logout: jest.fn() },
  uuid: () => 'uuid',
  setOnSessionExpired: jest.fn(),
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const hooks = require('../../api/hooks') as { useRequest: jest.Mock };
const route = { key: 'k', name: 'Booking', params: { requestId: 'r1' } } as never;

afterEach(async () => {
  await cleanup();
});
beforeEach(() => jest.clearAllMocks());

describe('booking confirmation screen', () => {
  it('shows the server-confirmed technician, the final quote and the assignment ID', async () => {
    hooks.useRequest.mockReturnValue(query({ data: job({ quoteMinor: 52500 }) }));
    await render(<BookingScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Booking confirmed')).toBeTruthy();
    expect(screen.getByText('Anil')).toBeTruthy();
    expect(screen.getByText('Final quote')).toBeTruthy();
    expect(screen.getByText(/525/)).toBeTruthy();
    expect(screen.getByText('Assignment ID')).toBeTruthy();
    expect(screen.getByText('asg-7f3a')).toBeTruthy();
  });

  it('continues to the live job screen', async () => {
    hooks.useRequest.mockReturnValue(query({ data: job() }));
    const navigation = makeNavigation();
    await render(<BookingScreen navigation={navigation as never} route={route} />);
    await fireEvent.press(screen.getByLabelText('Track this job'));
    expect(navigation.replace).toHaveBeenCalledWith('Job', { requestId: 'r1' });
  });

  it('never invents a technician or an assignment when the backend returns none', async () => {
    hooks.useRequest.mockReturnValue(query({ data: job({ technician: null }) }));
    await render(<BookingScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.queryByText('asg-7f3a')).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('shows loading and error states (with retry)', async () => {
    hooks.useRequest.mockReturnValue(query({ isPending: true }));
    const { rerender } = await render(<BookingScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByLabelText('Loading…')).toBeTruthy();

    const refetch = jest.fn();
    hooks.useRequest.mockReturnValue(
      query({ isError: true, error: new ApiError(500, 'INTERNAL', 'Internal server error'), refetch }),
    );
    await rerender(<BookingScreen navigation={makeNavigation() as never} route={route} />);
    await fireEvent.press(screen.getByLabelText('Retry'));
    expect(refetch).toHaveBeenCalled();
  });
});
