import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
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
const mockUploads = jest.fn();
jest.mock('../../evidence/useUploads', () => ({ useUploads: () => mockUploads() }));
jest.mock('expo-image-picker', () => ({}));
// Device clock pinned to the server clock (offset 0) so the review countdown is deterministic.
jest.mock('../../lib/useNow', () => ({ useNow: () => Date.parse('2030-01-01T10:10:00Z') }));
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

const photo = (id: string, workCycle = 1) => ({
  id,
  workCycle,
  contentType: 'image/png',
  sizeBytes: 72,
  finalizedAt: '2030-01-01T10:30:00Z',
  url: `https://storage.example.test/${id}?X-Amz-Signature=abc`,
  expiresAt: '2030-01-01T10:35:00Z',
});

afterEach(async () => {
  await cleanup();
});
beforeEach(() => {
  resetJobHooks(hooks);
  mockUploads.mockReturnValue({ items: [], add: jest.fn(), retry: jest.fn() });
});

describe('evidence: technician uploads and the two-image gate', () => {
  it('counts finalized photos against the required two and never claims more than two', async () => {
    showJob(hooks, 'TECHNICIAN', { state: 'IN_PROGRESS', startedAt: '2030-01-01T10:00:00Z' });
    hooks.useEvidence.mockReturnValue(query({ data: [] }));
    const { rerender } = await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('0 of 2 required')).toBeTruthy();

    hooks.useEvidence.mockReturnValue(query({ data: [photo('a')] }));
    await rerender(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('1 of 2 required')).toBeTruthy();

    hooks.useEvidence.mockReturnValue(query({ data: [photo('a'), photo('b'), photo('c')] }));
    await rerender(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('2 of 2 required')).toBeTruthy();
  });

  it('only photos from the current work cycle count (a rework round starts again at zero)', async () => {
    showJob(hooks, 'TECHNICIAN', { state: 'REWORK', workCycle: 2 });
    hooks.useEvidence.mockReturnValue(query({ data: [photo('a', 1), photo('b', 1)] }));
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('0 of 2 required (rework round)')).toBeTruthy();
  });

  it('shows upload progress per photo and a retry for a failed one', async () => {
    showJob(hooks, 'TECHNICIAN', { state: 'IN_PROGRESS', startedAt: '2030-01-01T10:00:00Z' });
    const retry = jest.fn();
    mockUploads.mockReturnValue({
      items: [
        { id: 'u1', uri: 'file:///1.jpg', status: 'uploading', progress: 0.4, error: null },
        { id: 'u2', uri: 'file:///2.jpg', status: 'error', progress: 0, error: 'Upload failed' },
      ],
      add: jest.fn(),
      retry,
    });
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Uploading 40%')).toBeTruthy();
    expect(screen.getByText('Upload failed')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Retry'));
    expect(retry).toHaveBeenCalledWith('u2');
  });

  it('lets the technician try to finish, and shows the SERVER refusal when the gate is not met', async () => {
    showJob(hooks, 'TECHNICIAN', { state: 'IN_PROGRESS', startedAt: '2030-01-01T10:00:00Z' });
    const err = new ApiError(409, 'EVIDENCE_REQUIRED', 'At least two finalized evidence images are required');
    const stop = mutation({
      mutateAsync: jest.fn(async () => {
        throw err;
      }),
    });
    hooks.useStop.mockReturnValue(stop);
    const { rerender } = await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    await fireEvent.press(screen.getByLabelText('Finish and submit for review'));
    expect(stop.mutateAsync).toHaveBeenCalledTimes(1); // the client does not decide; the server does

    hooks.useStop.mockReturnValue({ ...stop, isError: true, error: err });
    await rerender(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('At least two finalized evidence images are required')).toBeTruthy();
  });

  it('hides all evidence controls from the requester', async () => {
    showJob(hooks, 'REQUESTER', { state: 'IN_PROGRESS', startedAt: '2030-01-01T10:00:00Z' });
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.queryByText('Evidence photos')).toBeNull();
    expect(screen.queryByLabelText('Take a photo')).toBeNull();
    expect(screen.queryByLabelText('Finish and submit for review')).toBeNull();
  });
});

describe('review: requester approves or requests rework', () => {
  const underReview = { state: 'UNDER_REVIEW' as const, reviewDeadlineAt: '2030-01-01T10:20:00Z' };

  it('shows the current-cycle evidence and both review actions to the requester only', async () => {
    showJob(hooks, 'REQUESTER', underReview);
    hooks.useEvidence.mockReturnValue(query({ data: [photo('a'), photo('b')] }));
    const { rerender } = await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Review the evidence')).toBeTruthy();
    expect(screen.getAllByLabelText('Evidence photo')).toHaveLength(2);
    expect(screen.getByText('Auto-approves in 10:00 if you take no action.')).toBeTruthy();
    expect(screen.getByLabelText('Approve')).toBeTruthy();
    expect(screen.getByLabelText('Request rework')).toBeTruthy();

    showJob(hooks, 'TECHNICIAN', underReview);
    await rerender(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.queryByLabelText('Approve')).toBeNull();
    expect(screen.queryByLabelText('Request rework')).toBeNull();
    expect(screen.getByText('Waiting for the customer to review your evidence.')).toBeTruthy();
  });

  it('approves only after the requester confirms the dialog', async () => {
    showJob(hooks, 'REQUESTER', underReview);
    const review = mutation();
    hooks.useReview.mockReturnValue(review);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Approve')?.onPress?.();
    });
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    await fireEvent.press(screen.getByLabelText('Approve'));
    await waitFor(() => expect(review.mutateAsync).toHaveBeenCalledWith({ decision: 'APPROVE' }));
    expect(alert).toHaveBeenCalledWith('Approve this work?', expect.any(String), expect.any(Array));
  });

  it('does nothing if the requester backs out of the approval dialog', async () => {
    showJob(hooks, 'REQUESTER', underReview);
    const review = mutation();
    hooks.useReview.mockReturnValue(review);
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Not yet')?.onPress?.();
    });
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    await fireEvent.press(screen.getByLabelText('Approve'));
    expect(review.mutateAsync).not.toHaveBeenCalled();
  });

  it('requires a reason for rework, then sends it to the server', async () => {
    showJob(hooks, 'REQUESTER', underReview);
    const review = mutation();
    hooks.useReview.mockReturnValue(review);
    await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    await fireEvent.press(screen.getByLabelText('Request rework'));

    await fireEvent.press(screen.getByLabelText('Send rework request'));
    expect(screen.getByText('Enter at least 3 characters.')).toBeTruthy();
    expect(review.mutateAsync).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Reason'), '  Photo 2 is blurry  ');
    await fireEvent.press(screen.getByLabelText('Send rework request'));
    await waitFor(() =>
      expect(review.mutateAsync).toHaveBeenCalledWith({
        decision: 'REQUEST_REWORK',
        reason: 'Photo 2 is blurry',
      }),
    );
  });

  it('shows loading and error states for the evidence, and the server error if the review fails', async () => {
    showJob(hooks, 'REQUESTER', underReview);
    hooks.useEvidence.mockReturnValue(query({ isPending: true }));
    const { rerender } = await render(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByLabelText('Loading…')).toBeTruthy();

    const refetch = jest.fn();
    hooks.useEvidence.mockReturnValue(
      query({ isError: true, error: new ApiError(0, 'NETWORK', 'x'), refetch }),
    );
    await rerender(<JobScreen navigation={makeNavigation() as never} route={route} />);
    await fireEvent.press(screen.getByLabelText('Retry'));
    expect(refetch).toHaveBeenCalled();

    hooks.useEvidence.mockReturnValue(query({ data: [] }));
    hooks.useReview.mockReturnValue(
      mutation({ isError: true, error: new ApiError(409, 'ILLEGAL_TRANSITION', 'Illegal state transition') }),
    );
    await rerender(<JobScreen navigation={makeNavigation() as never} route={route} />);
    expect(screen.getByText('Illegal state transition')).toBeTruthy();
  });
});
