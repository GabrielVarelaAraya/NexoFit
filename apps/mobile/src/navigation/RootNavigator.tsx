import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '@nexofit/core';
import { View, ActivityIndicator } from 'react-native';
import type { RootStackParamList, AuthStackParamList, MainStackParamList } from './types';

// Auth screens
import { RoleSelectionScreen } from '../screens/auth/RoleSelectionScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { NewPasswordScreen } from '../screens/auth/NewPasswordScreen';
import { VerificationCodeScreen } from '../screens/auth/VerificationCodeScreen';

// Tab navigators
import { ClientTabNavigator } from './ClientTabNavigator';
import { AdminTabNavigator } from './AdminTabNavigator';

// Client screens (for modals/push screens)
import { SessionDetailScreen } from '../screens/client/SessionDetailScreen';
import { MyBookingsScreen } from '../screens/client/MyBookingsScreen';
import { JoinGymScreen } from '../screens/client/JoinGymScreen';
import { CreateGymScreen } from '../screens/client/CreateGymScreen';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

function AuthNavigator() {
  const theme = useTheme();

  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.crema },
      }}
    >
      <AuthStack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="NewPassword" component={NewPasswordScreen} />
      <AuthStack.Screen name="VerificationCode" component={VerificationCodeScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  const theme = useTheme();

  return (
    <MainStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.crema },
      }}
    >
      <MainStack.Screen name="ClientTabs" component={ClientTabNavigator} />
      <MainStack.Screen name="AdminTabs" component={AdminTabNavigator} />
      <MainStack.Screen name="SessionDetail" component={SessionDetailScreen} />
      <MainStack.Screen name="MyBookings" component={MyBookingsScreen} />
      <MainStack.Screen name="JoinGym" component={JoinGymScreen} />
      <MainStack.Screen name="CreateGym" component={CreateGymScreen} />
    </MainStack.Navigator>
  );
}

export function RootNavigator() {
  const { session, loading } = useAuth();
  const theme = useTheme();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.crema,
        }}
      >
        <ActivityIndicator size="large" color={theme.turquesa} />
      </View>
    );
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {session ? (
        <RootStack.Screen name="Main" component={MainNavigator} />
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
}
