import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@nexofit/core';
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

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.turquesa,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: {
          fontFamily: theme.fonts.uiSemiBold,
          fontSize: 11,
        },
        tabBarStyle: {
          paddingBottom: 4,
          height: 56,
          // Mismo color que el fondo de las pantallas (crema), no blanco.
          backgroundColor: theme.crema,
          borderTopColor: '#E5E7EB',
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
        }}
      />
    </Tab.Navigator>
  );
}
