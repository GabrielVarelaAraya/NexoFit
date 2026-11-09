import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, useTheme } from '@nexofit/core';
import { useUnreadNotifications } from '../contexts/NotificationsContext';
import { badgeValue } from './tabBadge';
import { swipeScreenLayout } from './SwipeTabsLayout';
import type { ClientTabParamList } from './types';

// Screens
import { HomeScreen } from '../screens/client/HomeScreen';
import { ScheduleScreen } from '../screens/client/ScheduleScreen';
import { ProgressScreen } from '../screens/client/ProgressScreen';
import { AppointmentsScreen } from '../screens/client/AppointmentsScreen';
import { ProfileScreen } from '../screens/client/ProfileScreen';

const Tab = createBottomTabNavigator<ClientTabParamList>();

export function ClientTabNavigator() {
  const theme = useTheme();
  const { unread } = useUnreadNotifications();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      // Deslizar a izquierda/derecha cambia de pestaña; el cambio se anima.
      screenLayout={swipeScreenLayout}
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        tabBarActiveTintColor: theme.textAccent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: {
          fontFamily: theme.fonts.uiSemiBold,
          fontSize: 11,
        },
        tabBarStyle: {
          paddingBottom: Math.max(insets.bottom, 4),
          height: 56 + insets.bottom,
          // Mismo color que el fondo de las pantallas (crema), no blanco.
          backgroundColor: theme.crema,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tab.Screen
        name="Inicio"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Clases"
        component={ScheduleScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Progreso"
        component={ProgressScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Citas"
        component={AppointmentsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          tabBarBadge: badgeValue(unread),
          tabBarBadgeStyle: {
            backgroundColor: colors.textAccent,
            color: colors.crema,
            fontSize: 10,
            fontFamily: theme.fonts.uiSemiBold,
          },
        }}
      />
    </Tab.Navigator>
  );
}
