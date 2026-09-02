import { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { LoginScreen, SignUpScreen, ForgotPasswordScreen } from '../screens/auth';
import {
  ScheduleScreen,
  SessionDetailScreen,
  type SessionDetailParamList,
  MyBookingsScreen,
  ProfileScreen,
} from '../screens/main';
import { colors, fonts } from '@nexofit/core';
import { View, ActivityIndicator } from 'react-native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<SessionDetailParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.turquesa,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: { fontFamily: fonts.uiSemiBold, fontSize: 11 },
        tabBarStyle: { paddingBottom: 4, height: 56 },
      }}
    >
      <Tab.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{ tabBarLabel: 'Schedule' }}
      />
      <Tab.Screen
        name="MyBookings"
        component={MyBookingsScreen}
        options={{ tabBarLabel: 'My Bookings' }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  const [screen, setScreen] = useState<'login' | 'signup' | 'forgot'>('login');

  switch (screen) {
    case 'signup':
      return <SignUpScreen onSwitchToLogin={() => setScreen('login')} />;
    case 'forgot':
      return <ForgotPasswordScreen onBack={() => setScreen('login')} />;
    default:
      return (
        <LoginScreen
          onSwitchToSignUp={() => setScreen('signup')}
          onSwitchToForgot={() => setScreen('forgot')}
        />
      );
  }
}

function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.crema,
        }}
      >
        <ActivityIndicator size="large" color={colors.turquesa} />
      </View>
    );
  }

  if (!session) {
    return <AuthStack />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen
        name="SessionDetail"
        component={SessionDetailScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
