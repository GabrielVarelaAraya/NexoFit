import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createRecoverySessionStore } from './recoverySessionStore';

export const authStorage = AsyncStorage;
export const recoverySessionStore = createRecoverySessionStore(
  authStorage,
  'nexofit:password-recovery:' + (Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL ?? '')
);
