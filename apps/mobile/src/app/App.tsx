import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '@nexofit/core';
import { RootNavigator } from '../navigation/RootNavigator';
import { setSupabaseConfig } from '@nexofit/core';
import Constants from 'expo-constants';

// Configure Supabase with Expo environment variables
const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (supabaseUrl && supabaseAnonKey) {
  setSupabaseConfig({ url: supabaseUrl, key: supabaseAnonKey });
} else {
  console.warn(
    'Supabase credentials not found in app.config.js extra. Check your .env and app.config.js'
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </ThemeProvider>
    </AuthProvider>
  );
}
