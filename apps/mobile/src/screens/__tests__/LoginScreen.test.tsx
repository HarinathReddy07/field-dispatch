import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '../../api/client';
import { useSession } from '../../state/session';
import { LoginScreen } from '../LoginScreen';

jest.mock('../../api/instance', () => ({
  api: { hasSession: async () => false, get: jest.fn(), login: jest.fn(), logout: jest.fn() },
  uuid: () => 'uuid',
  setOnSessionExpired: jest.fn(),
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const signIn = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useSession.setState({ status: 'anon', user: null, signIn });
});
afterEach(async () => {
  await cleanup();
});

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
}

describe('login screen', () => {
  it('renders the sign-in form and offers no role choice (the role comes from the backend)', async () => {
    await render(<LoginScreen />);
    expect(screen.getByText('Field Dispatch')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByLabelText('Sign in')).toBeTruthy();
    expect(screen.queryByText(/admin/i)).toBeNull();
    expect(screen.queryByLabelText(/role/i)).toBeNull();
  });

  it('keeps the password hidden and validates before calling the server', async () => {
    await render(<LoginScreen />);
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    await fill('not-an-email', '');
    await fireEvent.press(screen.getByLabelText('Sign in'));
    expect(screen.getByText('Enter a valid email and your password.')).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signs in with the trimmed email and the typed password only', async () => {
    signIn.mockResolvedValue(undefined);
    await render(<LoginScreen />);
    await fill('  requester1@dispatch.test ', 'Passw0rd!dev');
    await fireEvent.press(screen.getByLabelText('Sign in'));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('requester1@dispatch.test', 'Passw0rd!dev'));
    expect(signIn.mock.calls[0]).toHaveLength(2); // no role argument: the backend decides
  });

  it('shows one uniform message for wrong credentials (never reveals whether the account exists)', async () => {
    signIn.mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', 'Invalid credentials'));
    await render(<LoginScreen />);
    await fill('someone@dispatch.test', 'wrong-password');
    await fireEvent.press(screen.getByLabelText('Sign in'));
    expect(await screen.findByText('Invalid email or password.')).toBeTruthy();
  });

  it('shows distinct, safe messages for an offline device and for rate limiting', async () => {
    signIn.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'fetch failed'));
    await render(<LoginScreen />);
    await fill('someone@dispatch.test', 'x'.repeat(8));
    await fireEvent.press(screen.getByLabelText('Sign in'));
    expect(await screen.findByText('Cannot reach the server. Check your connection.')).toBeTruthy();

    signIn.mockRejectedValueOnce(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
    await fireEvent.press(screen.getByLabelText('Sign in'));
    expect(await screen.findByText('Too many attempts. Try again shortly.')).toBeTruthy();
  });
});
