import { job, makeNavigation, mutation, query, signInAs } from './fixtures';

/**
 * Shared wiring for the three JobScreen suites (arrival, active job, evidence/review). Each suite calls
 * jest.mock for the same modules (jest hoists mocks per file), then uses these helpers to configure them.
 */
export interface JobHooks {
  useRequest: jest.Mock;
  useIssueOtp: jest.Mock;
  useArrive: jest.Mock;
  useStart: jest.Mock;
  useStop: jest.Mock;
  useReview: jest.Mock;
  useCancel: jest.Mock;
  useEvidence: jest.Mock;
  pingLocation: jest.Mock;
}

export function resetJobHooks(hooks: JobHooks): void {
  jest.clearAllMocks();
  hooks.useIssueOtp.mockReturnValue(mutation());
  hooks.useArrive.mockReturnValue(mutation());
  hooks.useStart.mockReturnValue(mutation());
  hooks.useStop.mockReturnValue(mutation());
  hooks.useReview.mockReturnValue(mutation());
  hooks.useCancel.mockReturnValue(mutation());
  hooks.useEvidence.mockReturnValue(query({ data: [] }));
  hooks.pingLocation.mockResolvedValue({ accepted: true });
}

export const showJob = (hooks: JobHooks, role: 'REQUESTER' | 'TECHNICIAN', over = {}) => {
  signInAs(role);
  hooks.useRequest.mockReturnValue(query({ data: job(over) }));
};

export { job, makeNavigation, mutation, query };
