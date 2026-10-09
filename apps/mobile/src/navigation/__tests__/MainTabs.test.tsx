import { NavigationContainer } from '@react-navigation/native';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { signInAs } from '../../testing/fixtures';
import { MainTabs } from '../MainTabs';

jest.mock('../../api/instance', () => ({
  api: { hasSession: async () => false, get: jest.fn(), login: jest.fn(), logout: jest.fn() },
  uuid: () => 'uuid',
  setOnSessionExpired: jest.fn(),
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
// The tab shell is what is under test; the screens have their own suites.
jest.mock('../../screens/HomeScreen', () => ({
  HomeScreen: () => {
    const { Text } = require('react-native');
    return <Text>home-screen</Text>;
  },
}));
jest.mock('../../screens/HistoryScreen', () => ({
  HistoryScreen: () => {
    const { Text } = require('react-native');
    return <Text>history-screen</Text>;
  },
}));

afterEach(async () => {
  await cleanup();
});

const mount = () =>
  render(
    <NavigationContainer>
      <MainTabs />
    </NavigationContainer>,
  );

describe('bottom tabs', () => {
  it.each(['REQUESTER', 'TECHNICIAN'] as const)(
    '%s gets Jobs and History tabs and can switch between them',
    async (role) => {
      signInAs(role);
      await mount();
      expect(screen.getByText('home-screen')).toBeTruthy();
      expect(screen.getByLabelText('Jobs')).toBeTruthy();
      expect(screen.getByLabelText('History')).toBeTruthy();

      await fireEvent.press(screen.getByLabelText('History'));
      expect(screen.getByText('history-screen')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Jobs'));
      expect(screen.getByText('home-screen')).toBeTruthy();
    },
  );

  it('titles the first tab with the role the BACKEND returned', async () => {
    signInAs('TECHNICIAN');
    await mount();
    expect(screen.getAllByText('Technician').length).toBeGreaterThan(0);
    expect(screen.queryByText('Requester')).toBeNull();
  });

  it('gives admins no History tab (the operations console is a web app)', async () => {
    signInAs('ADMIN');
    await mount();
    expect(screen.getByLabelText('Jobs')).toBeTruthy();
    expect(screen.queryByLabelText('History')).toBeNull();
  });
});
