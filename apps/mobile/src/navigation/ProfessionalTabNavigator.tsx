import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@nexofit/core';
import type { ProfessionalTabParamList } from './types';
import { ProfessionalAgendaScreen } from '../screens/professional/ProfessionalAgendaScreen';
import { ProfessionalAvailabilityScreen } from '../screens/professional/ProfessionalAvailabilityScreen';
import { ProfessionalProfileScreen } from '../screens/professional/ProfessionalProfileScreen';

const Tab = createBottomTabNavigator<ProfessionalTabParamList>();

export function ProfessionalTabNavigator() {
  const theme = useTheme();
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
        }}
      />
    </Tab.Navigator>
  );
}
