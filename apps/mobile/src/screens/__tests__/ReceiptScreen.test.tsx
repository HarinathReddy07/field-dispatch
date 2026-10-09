import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError } from '../../api/client';
import { job, makeNavigation, query } from '../../testing/fixtures';
import { ReceiptScreen } from '../ReceiptScreen';

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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const hooks = require('../../api/hooks') as { useRequest: jest.Mock };
const route = { key: 'k', name: 'Receipt', params: { requestId: 'r1' } } as never;

afterEach(async () => {
  await cleanup();
});
beforeEach(() => jest.clearAllMocks());

describe('receipt screen', () => {
  it('shows the single mock settlement, labelled as a mock, with its reference', async () => {
    hooks.useRequest.mockReturnValue(
      query({
        data: job({
          state: 'SETTLED',
          settlement: { amountMinor: 52500, status: 'SUCCEEDED', providerRef: 'MOCK-123' } as never,
        }),
      }),
    );
    await render(<ReceiptScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Receipt')).toBeTruthy();
    expect(screen.getByText('PANEL-42')).toBeTruthy();
    expect(screen.getByText('Mock settlement')).toBeTruthy();
    expect(screen.getByText(/525/)).toBeTruthy();
    expect(screen.getByText('MOCK-123')).toBeTruthy();
    expect(screen.getByText('Status: succeeded')).toBeTruthy();
  });

  it('says so plainly when there is no payment record (cancelled / not settled)', async () => {
    hooks.useRequest.mockReturnValue(query({ data: job({ state: 'CANCELLED', settlement: null }) }));
    const { rerender } = await render(<ReceiptScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('No payment record')).toBeTruthy();
    expect(screen.getByText('This request was cancelled.')).toBeTruthy();
    expect(screen.queryByText('Mock settlement')).toBeNull();

    hooks.useRequest.mockReturnValue(query({ data: job({ state: 'UNDER_REVIEW', settlement: null }) }));
    await rerender(<ReceiptScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Not settled yet.')).toBeTruthy();
  });

  it('shows loading and error states (with retry); a foreign receipt is just "not found"', async () => {
    hooks.useRequest.mockReturnValue(query({ isPending: true }));
    const { rerender } = await render(<ReceiptScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByLabelText('Loading…')).toBeTruthy();

    const refetch = jest.fn();
    hooks.useRequest.mockReturnValue(
      query({ isError: true, error: new ApiError(404, 'NOT_FOUND', 'Resource not found'), refetch }),
    );
    await rerender(<ReceiptScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Resource not found')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Retry'));
    expect(refetch).toHaveBeenCalled();
  });
});
