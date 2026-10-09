import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { NearbyTechnician } from '@dispatch/contracts';
import { ApiError } from '../../api/client';
import { makeNavigation, mutation, query } from '../../testing/fixtures';
import { NearbyScreen } from '../NearbyScreen';

jest.mock('../../api/hooks', () => ({ useNearby: jest.fn(), useConfirm: jest.fn() }));
jest.mock('../../api/instance', () => ({
  api: { hasSession: async () => false, get: jest.fn(), login: jest.fn(), logout: jest.fn() },
  uuid: () => 'uuid',
  setOnSessionExpired: jest.fn(),
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const hooks = require('../../api/hooks') as { useNearby: jest.Mock; useConfirm: jest.Mock };
const route = { key: 'k', name: 'Nearby', params: { requestId: 'r1' } } as never;

const tech = (over: Partial<NearbyTechnician> = {}): NearbyTechnician =>
  ({
    technicianId: 'tech-1',
    name: 'Anil',
    rating: 4.8,
    distanceKm: 0.39,
    availability: 'AVAILABLE',
    quoteMinor: 45585,
    ...over,
  }) as NearbyTechnician;

afterEach(async () => {
  await cleanup();
});
beforeEach(() => {
  jest.clearAllMocks();
  hooks.useConfirm.mockReturnValue(mutation());
});

describe('nearby technicians screen', () => {
  it('shows a loading state while the backend search runs', async () => {
    hooks.useNearby.mockReturnValue(query({ isPending: true }));
    await render(<NearbyScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByLabelText('Searching nearby…')).toBeTruthy();
  });

  it('lists the backend results in the order received, with distance, rating and the server quote', async () => {
    hooks.useNearby.mockReturnValue(
      query({
        data: [
          tech(),
          tech({ technicianId: 'tech-4', name: 'Divya', rating: 4.5, distanceKm: 3.2, quoteMinor: 61000 }),
        ],
      }),
    );
    await render(<NearbyScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Anil')).toBeTruthy();
    expect(screen.getByText(/4\.8 ★ · 0\.4 km away/)).toBeTruthy();
    expect(screen.getByText(/455\.85/)).toBeTruthy();
    expect(screen.getByText(/4\.5 ★ · 3\.2 km away/)).toBeTruthy();
    const buttons = screen.getAllByLabelText(/^Book /);
    expect(buttons.map((b) => b.props.accessibilityLabel)).toEqual(['Book Anil', 'Book Divya']);
  });

  it('books only after the server confirms, then opens the booking confirmation', async () => {
    const confirm = mutation();
    hooks.useConfirm.mockReturnValue(confirm);
    hooks.useNearby.mockReturnValue(query({ data: [tech()] }));
    const navigation = makeNavigation();
    await render(<NearbyScreen navigation={navigation as never} route={route} />);
    await fireEvent.press(screen.getByLabelText('Book Anil'));
    await waitFor(() => expect(confirm.mutateAsync).toHaveBeenCalledWith('tech-1'));
    expect(navigation.replace).toHaveBeenCalledWith('Booking', { requestId: 'r1' });
  });

  it('keeps the user here, shows the conflict and refreshes the list when the booking is refused', async () => {
    const refetch = jest.fn();
    const err = new ApiError(409, 'TECHNICIAN_UNAVAILABLE', 'The technician is no longer available');
    const confirm = mutation({
      mutateAsync: jest.fn(async () => {
        throw err;
      }),
      isError: true,
      error: err,
    });
    hooks.useConfirm.mockReturnValue(confirm);
    hooks.useNearby.mockReturnValue(query({ data: [tech()], refetch }));
    const navigation = makeNavigation();
    await render(<NearbyScreen navigation={navigation as never} route={route} />);
    await fireEvent.press(screen.getByLabelText('Book Anil'));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    expect(screen.getByText('The technician is no longer available')).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('shows empty and error states (with retry)', async () => {
    hooks.useNearby.mockReturnValue(query({ data: [] }));
    const { rerender } = await render(<NearbyScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('No technicians available nearby')).toBeTruthy();

    const refetch = jest.fn();
    hooks.useNearby.mockReturnValue(
      query({ isError: true, error: new ApiError(0, 'NETWORK', 'x'), refetch }),
    );
    await rerender(<NearbyScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('You appear to be offline.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Retry'));
    expect(refetch).toHaveBeenCalled();
  });
});
