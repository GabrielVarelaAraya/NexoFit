import type { NavigatorScreenParams } from '@react-navigation/native';
import type { SessionWithType } from '../types/screens';

// Auth Stack
export type AuthStackParamList = {
  RoleSelection: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  NewPassword: { token?: string; type?: 'signup' | 'recovery'; email?: string };
  VerificationCode: { email: string; token?: string; type?: 'signup' | 'recovery' };
};

// Client Tabs
export type ClientTabParamList = {
  Inicio: undefined;
  Clases: undefined;
  Progreso: undefined;
  Citas: undefined;
  Perfil: undefined;
};

// Admin Tabs
export type AdminTabParamList = {
  Dashboard: undefined;
  Agenda: undefined;
  Clientes: undefined;
  Mas: undefined;
};

// Trainer Tabs
export type TrainerTabParamList = {
  Inicio: undefined;
  Clases: undefined;
  Progreso: undefined;
  Citas: undefined;
  Perfil: undefined;
};

// Main Stack (after auth)
export type MainStackParamList = {
  ClientTabs: NavigatorScreenParams<ClientTabParamList>;
  AdminTabs: NavigatorScreenParams<AdminTabParamList>;
  TrainerTabs: NavigatorScreenParams<TrainerTabParamList>;
  ClassDetail: { sessionId: string };
  BookingConfirmed: { sessionId: string };
  QRAccess: { bookingId: string };
  SessionDetail: { sessionId: string; sessionData: SessionWithType };
  MyBookings: undefined;
  JoinGym: undefined;
  CreateGym: undefined;
  WorkoutDetail: { programId: string };
  ExerciseDetail: { exerciseId: string };
  CompareMetrics: undefined;
  AppointmentConfirm: { specialistId: string };
  MembershipPlans: undefined;
  AddPaymentMethod: undefined;
  PaymentHistory: undefined;
  Notifications: undefined;
  Chat: { coachId: string };
  RateClass: { sessionId: string };
  Support: undefined;
  Settings: undefined;
};

// Root Stack
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};
