import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HistoryScreen } from '../screens/HistoryScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { useSession } from '../state/session';
import { fonts } from '../ui/theme';
import type { TabParams } from './types';

const Tab = createBottomTabNavigator<TabParams>();

/**
 * Bottom tabs: "Jobs" (the active work for this role) and "History" (completed jobs and receipts).
 * The role comes from the backend session; admins use the web console, so they only get the notice screen.
 */
export function MainTabs() {
  const role = useSession((s) => s.user?.role);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.semibold },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: role === 'TECHNICIAN' ? 'Technician' : role === 'ADMIN' ? 'Operations' : 'Requester',
          tabBarLabel: 'Jobs',
          tabBarAccessibilityLabel: 'Jobs',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} color={color} size={size} />
          ),
        }}
      />
      {role !== 'ADMIN' && (
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{
            title: 'History',
            tabBarAccessibilityLabel: 'History',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'time' : 'time-outline'} color={color} size={size} />
            ),
          }}
        />
      )}
    </Tab.Navigator>
  );
}
