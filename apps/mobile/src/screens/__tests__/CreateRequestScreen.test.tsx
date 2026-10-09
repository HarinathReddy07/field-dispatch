import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '../../api/client';
import { PLACES } from '../../lib/route';
import { job, makeNavigation, mutation } from '../../testing/fixtures';
import { CreateRequestScreen } from '../CreateRequestScreen';

jest.mock('../../api/hooks', () => ({ useCreateRequest: jest.fn() }));
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
const hooks = require('../../api/hooks') as { useCreateRequest: jest.Mock };
const route = { key: 'k', name: 'CreateRequest' } as never;

afterEach(async () => {
  await cleanup();
});
beforeEach(() => jest.clearAllMocks());

describe('create request screen (request details)', () => {
  it('renders the request form with the categories and simulated places', async () => {
    hooks.useCreateRequest.mockReturnValue(mutation());
    await render(<CreateRequestScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('New inspection request')).toBeTruthy();
    expect(screen.getByLabelText('Asset ID')).toBeTruthy();
    expect(screen.getByLabelText('Electrical inspection')).toBeTruthy();
    expect(screen.getByLabelText('Mechanical inspection')).toBeTruthy();
    for (const p of PLACES) expect(screen.getByLabelText(p.name)).toBeTruthy();
    expect(screen.getByLabelText('Find technicians')).toBeTruthy();
  });

  it('requires the asset ID and sends nothing to the server until the form is valid', async () => {
    const create = mutation();
    hooks.useCreateRequest.mockReturnValue(create);
    await render(<CreateRequestScreen navigation={makeNavigation() as never} route={route} />);
    await fireEvent.press(screen.getByLabelText('Find technicians'));
    expect(screen.getByText('Enter the asset ID.')).toBeTruthy();
    expect(create.mutateAsync).not.toHaveBeenCalled();
  });

  it('submits a normalised payload (numeric lat/lon, ISO window) and moves on to the nearby search', async () => {
    const created = job({ id: 'new-request-1', state: 'REQUESTED' });
    const create = mutation({ mutateAsync: jest.fn(async () => created) });
    hooks.useCreateRequest.mockReturnValue(create);
    const navigation = makeNavigation();
    await render(<CreateRequestScreen navigation={navigation as never} route={route} />);

    await fireEvent.changeText(screen.getByLabelText('Asset ID'), '  panel-7  ');
    await fireEvent.press(screen.getByLabelText('Mechanical inspection'));
    await fireEvent.press(screen.getByLabelText(PLACES[1]!.name));
    await fireEvent.press(screen.getByLabelText('Find technicians'));

    await waitFor(() => expect(create.mutateAsync).toHaveBeenCalledTimes(1));
    const sent = (create.mutateAsync.mock.calls[0] as unknown[])[0] as {
      assetId: string;
      category: string;
      location: { lat: number; lon: number };
      windowStart: string;
      windowEnd: string;
    };
    expect(sent.assetId).toBe('panel-7'); // surrounding whitespace is trimmed before sending
    expect(sent.category).toBe('MECHANICAL_INSPECTION');
    expect(sent.location).toEqual(PLACES[1]!.location);
    expect(typeof sent.location.lat).toBe('number');
    expect(new Date(sent.windowStart).toISOString()).toBe(sent.windowStart);
    expect(Date.parse(sent.windowEnd)).toBeGreaterThan(Date.parse(sent.windowStart));
    expect(Object.keys(sent)).not.toContain('role');
    expect(navigation.replace).toHaveBeenCalledWith('Nearby', { requestId: 'new-request-1' });
  });

  it('shows the server error and does not navigate when creation fails', async () => {
    const err = new ApiError(400, 'VALIDATION_FAILED', 'Request validation failed');
    const create = mutation({
      mutateAsync: jest.fn(async () => {
        throw err;
      }),
      isError: true,
      error: err,
    });
    hooks.useCreateRequest.mockReturnValue(create);
    const navigation = makeNavigation();
    await render(<CreateRequestScreen navigation={navigation as never} route={route} />);
    await fireEvent.changeText(screen.getByLabelText('Asset ID'), 'PANEL-1');
    await fireEvent.press(screen.getByLabelText('Find technicians'));
    expect(screen.getByText('Request validation failed')).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
