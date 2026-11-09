import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationsProvider } from '../contexts/NotificationsContext';
import { useRealtimeBookings } from '../hooks/useRealtimeBookings';
import { ThemeProvider } from '@nexofit/core';
import { RootNavigator } from '../navigation/RootNavigator';
import { documentTitleFor } from '../navigation/documentTitle';
import { setSupabaseConfig } from '@nexofit/core';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authStorage } from '../utils/authStorage';
import { useFonts } from 'expo-font';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { DialogHost, ErrorBoundary, LoadingView } from '../components/ui';

// Configure Supabase with Expo environment variables
const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (supabaseUrl && supabaseAnonKey) {
  setSupabaseConfig({
    url: supabaseUrl,
    key: supabaseAnonKey,
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
} else {
  console.warn(
    'Supabase credentials not found in app.config.js extra. Check your .env and app.config.js'
  );
}

// Puente sin UI: mantiene los cupos y reservas en vivo mientras haya sesión
// con un gimnasio (Realtime sobre bookings).
function RealtimeBridge() {
  useRealtimeBookings();
  return null;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_800ExtraBold,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return <LoadingView label="Cargando NexoFit…" />;
  }

  // SafeAreaProvider global: el toast y los diálogos (fuera de los navegadores)
  // necesitan los márgenes del notch.
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <NotificationsProvider>
            <RealtimeBridge />
            <ThemeProvider>
              <NavigationContainer
                documentTitle={{
                  formatter: (options, route) => documentTitleFor(route?.name, options?.title),
                }}
              >
                <RootNavigator />
              </NavigationContainer>
              <DialogHost />
            </ThemeProvider>
          </NotificationsProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
