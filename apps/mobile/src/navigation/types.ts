import type { NavigatorScreenParams } from '@react-navigation/native';

/** Bottom tabs shown to signed-in requesters and technicians. */
export type TabParams = {
  Home: undefined;
  History: undefined;
};

export type RootStackParams = {
  Login: undefined;
  Main: NavigatorScreenParams<TabParams> | undefined;
  CreateRequest: undefined;
  Nearby: { requestId: string };
  Booking: { requestId: string };
  Job: { requestId: string };
  Receipt: { requestId: string };
};
