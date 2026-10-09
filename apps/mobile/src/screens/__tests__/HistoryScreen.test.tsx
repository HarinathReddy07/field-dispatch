import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '../../api/client';
import { historyItem, makeNavigation, mutation, query, signInAs } from '../../testing/fixtures';
import { HistoryScreen } from '../HistoryScreen';

jest.mock('../../api/hooks', () => ({ useHistory: jest.fn(), useReorder: jest.fn() }));
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
const hooks = require('../../api/hooks') as { useHistory: jest.Mock; useReorder: jest.Mock };
const route = { key: 'k', name: 'History' } as never;

const settled = historyItem({
  id: 'r1',
  assetId: 'PANEL-42',
  settlement: { amountMinor: 52500, status: 'SUCCEEDED', providerRef: 'MOCK-123' } as never,
});

afterEach(async () => {
  await cleanup();
});
beforeEach(() => {
  jest.clearAllMocks();
  hooks.useReorder.mockReturnValue(mutation());
});

describe('history screen', () => {
  it('requester: lists completed jobs with the mock settlement, opens the receipt and can order again', async () => {
    signInAs('REQUESTER');
    hooks.useHistory.mockReturnValue(query({ data: [settled] }));
    const reorder = mutation({ mutateAsync: jest.fn(async () => ({ id: 'fresh-1' })) });
    hooks.useReorder.mockReturnValue(reorder);
    const navigation = makeNavigation();
    await render(<HistoryScreen navigation={navigation as never} route={route} />);

    expect(screen.getByText('PANEL-42')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText(/Mock settlement · /)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('PANEL-42, completed'));
    expect(navigation.navigate).toHaveBeenCalledWith('Receipt', { requestId: 'r1' });

    await fireEvent.press(screen.getByLabelText('Order again'));
    await waitFor(() => expect(reorder.mutateAsync).toHaveBeenCalledWith('r1'));
    expect(navigation.replace).toHaveBeenCalledWith('Nearby', { requestId: 'fresh-1' });
  });

  it('technician: sees completed jobs but no requester-only "Order again" control', async () => {
    signInAs('TECHNICIAN');
    hooks.useHistory.mockReturnValue(query({ data: [settled] }));
    await render(<HistoryScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('PANEL-42')).toBeTruthy();
    expect(screen.queryByLabelText('Order again')).toBeNull();
  });

  it('marks cancelled jobs distinctly and shows no payment for them', async () => {
    signInAs('REQUESTER');
    hooks.useHistory.mockReturnValue(
      query({ data: [historyItem({ id: 'r2', assetId: 'PUMP-9', state: 'CANCELLED' })] }),
    );
    await render(<HistoryScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(screen.queryByText(/Mock settlement/)).toBeNull();
  });

  it('shows the reorder failure without leaving the screen', async () => {
    signInAs('REQUESTER');
    hooks.useHistory.mockReturnValue(query({ data: [settled] }));
    const err = new ApiError(404, 'NOT_FOUND', 'Resource not found');
    hooks.useReorder.mockReturnValue(
      mutation({
        mutateAsync: jest.fn(async () => {
          throw err;
        }),
        isError: true,
        error: err,
      }),
    );
    const navigation = makeNavigation();
    await render(<HistoryScreen navigation={navigation as never} route={route} />);
    await fireEvent.press(screen.getByLabelText('Order again'));
    expect(screen.getByText('Resource not found')).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('shows loading, empty and error states', async () => {
    signInAs('REQUESTER');
    hooks.useHistory.mockReturnValue(query({ isPending: true }));
    const { rerender } = await render(<HistoryScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByLabelText('Loading…')).toBeTruthy();

    hooks.useHistory.mockReturnValue(query({ data: [] }));
    await rerender(<HistoryScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Nothing here yet')).toBeTruthy();

    const refetch = jest.fn();
    hooks.useHistory.mockReturnValue(
      query({ isError: true, error: new ApiError(0, 'NETWORK', 'x'), refetch }),
    );
    await rerender(<HistoryScreen navigation={makeNavigation() as never} route={route} />);
    await fireEvent.press(screen.getByLabelText('Retry'));
    expect(refetch).toHaveBeenCalled();
  });
});
