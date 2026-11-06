import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors, useTheme } from '@nexofit/core';
import { useUnreadNotifications } from '../contexts/NotificationsContext';
import { badgeValue } from './tabBadge';
import type { ProfessionalTabParamList } from './types';
import { ProfessionalAgendaScreen } from '../screens/professional/ProfessionalAgendaScreen';
import { ProfessionalAvailabilityScreen } from '../screens/professional/ProfessionalAvailabilityScreen';
import { ProfessionalProfileScreen } from '../screens/professional/ProfessionalProfileScreen';

const Tab = createBottomTabNavigator<ProfessionalTabParamList>();

export function ProfessionalTabNavigator() {
  const theme = useTheme();
  const { unread } = useUnreadNotifications();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.textAccent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: { fontFamily: theme.fonts.uiSemiBold, fontSize: 11 },
        tabBarStyle: { backgroundColor: theme.crema, borderTopColor: '#E5E7EB' },
      }}
    >
      <Tab.Screen
        name="AgendaProfesional"
        component={ProfessionalAgendaScreen}
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Disponibilidad"
        component={ProfessionalAvailabilityScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="time" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="PerfilProfesional"
        component={ProfessionalProfileScreen}
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
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
