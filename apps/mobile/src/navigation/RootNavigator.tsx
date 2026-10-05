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
import { WorkoutLogScreen } from '../screens/client/WorkoutLogScreen';

// Admin screens (from admin tabs)
import { CreateSessionScreen } from '../screens/admin/CreateSessionScreen';
import { PublishProgramScreen } from '../screens/admin/PublishProgramScreen';
import { SendNotificationScreen } from '../screens/admin/SendNotificationScreen';
import { PaymentsScreen } from '../screens/admin/PaymentsScreen';
import { GymContentScreen } from '../screens/admin/GymContentScreen';

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
  const { membership } = useAuth();

  // Rol resuelto antes de montar el stack (RootNavigator espera a
  // membershipLoading): admin/coach entran a su panel de gestión
  // (clases, programas, clientes, pagos); los miembros ven la app cliente.
  const isStaff = membership?.role === 'admin' || membership?.role === 'coach';

  return (
    <MainStack.Navigator
      initialRouteName={isStaff ? 'AdminTabs' : 'ClientTabs'}
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
      <MainStack.Screen name="WorkoutLog" component={WorkoutLogScreen} />
      <MainStack.Screen name="CreateSession" component={CreateSessionScreen} />
      <MainStack.Screen name="PublishProgram" component={PublishProgramScreen} />
      <MainStack.Screen name="SendNotification" component={SendNotificationScreen} />
      <MainStack.Screen name="Payments" component={PaymentsScreen} />
      <MainStack.Screen name="GymContent" component={GymContentScreen} />
    </MainStack.Navigator>
  );
}

export function RootNavigator() {
  const { session, loading, membershipLoading } = useAuth();
  const theme = useTheme();

  // membershipLoading: con sesión pero aún sin rol resuelto, mantener el
  // spinner para no montar las pestañas equivocadas (initialRouteName).
  if (loading || membershipLoading) {
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
