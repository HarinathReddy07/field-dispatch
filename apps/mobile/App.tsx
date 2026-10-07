import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from './src/api/client';
import type { RootStackParams } from './src/navigation/types';
import { useLiveEvents } from './src/realtime/live';
import { BookingScreen } from './src/screens/BookingScreen';
import { CreateRequestScreen } from './src/screens/CreateRequestScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { JobScreen } from './src/screens/JobScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { NearbyScreen } from './src/screens/NearbyScreen';
import { ReceiptScreen } from './src/screens/ReceiptScreen';
import { useSession } from './src/state/session';
import { Body, ErrorBox, Loading, Screen } from './src/ui/components';

const Stack = createNativeStackNavigator<RootStackParams>();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      // GETs are safe to retry; never retry auth or validation failures
      retry: (count, error) =>
        count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});

/** Navigation is derived from the BACKEND session (role from the API), never from a client-side flag. */
function Root() {
  const { status, user, error, bootstrap } = useSession();
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
  useLiveEvents(status === 'authed');

  if (status === 'loading')
    return (
      <Screen>
        <Loading label="Starting…" />
      </Screen>
    );
  if (status === 'error') {
    return (
      <Screen>
        <ErrorBox
          error={new ApiError(0, 'NETWORK', error ?? 'Could not reach the server.')}
          onRetry={() => void bootstrap()}
        />
        <Body soft>Your session is kept; we will sign you in again as soon as the server is reachable.</Body>
      </Screen>
    );
  }
  if (status === 'anon' || !user) return <LoginScreen />;

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: user.role === 'TECHNICIAN' ? 'Technician' : 'Requester' }}
      />
      <Stack.Screen name="CreateRequest" component={CreateRequestScreen} options={{ title: 'New request' }} />
      <Stack.Screen name="Nearby" component={NearbyScreen} options={{ title: 'Nearby technicians' }} />
      <Stack.Screen
        name="Booking"
        component={BookingScreen}
        options={{ title: 'Booking', headerBackVisible: false }}
      />
      <Stack.Screen name="Job" component={JobScreen} options={{ title: 'Job' }} />
      <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
      <Stack.Screen name="Receipt" component={ReceiptScreen} options={{ title: 'Receipt' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <Root />
          <StatusBar style="auto" />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
