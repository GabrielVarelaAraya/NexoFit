import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@nexofit/core';
import type { AdminTabParamList } from './types';

// Screens
import { DashboardScreen } from '../screens/admin/DashboardScreen';
import { AgendaScreen } from '../screens/admin/AgendaScreen';
import { ClientsScreen } from '../screens/admin/ClientsScreen';
import { MoreScreen } from '../screens/admin/MoreScreen';

const Tab = createBottomTabNavigator<AdminTabParamList>();

export function AdminTabNavigator() {
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
          backgroundColor: theme.white,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Agenda"
        component={AgendaScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Clientes"
        component={ClientsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Mas"
        component={MoreScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
