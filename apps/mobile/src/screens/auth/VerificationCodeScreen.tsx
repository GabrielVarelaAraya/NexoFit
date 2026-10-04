import { useState, useEffect } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { AuthStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'VerificationCode'>;
  route: RouteProp<AuthStackParamList, 'VerificationCode'>;
}

export function VerificationCodeScreen({ route }: Props) {
  const theme = useTheme();
  const { verifyOtp, session } = useAuth();
  const { email, token, type } = route.params;
  const [loading, setLoading] = useState(false);

  // If we received a token from deep link (magic link), auto-verify.
  // Con sesión activa, RootNavigator cambia solo a la app principal.
  useEffect(() => {
    if (token && type && email) {
      autoVerify(token, type);
    }
  }, [token, type, email]);

  const autoVerify = async (token: string, type: 'signup' | 'recovery') => {
    Keyboard.dismiss();
    setLoading(true);
    const { error } = await verifyOtp(email, token, type);
    setLoading(false);
    if (error) {
      Alert.alert('Error', error);
    }
    // Éxito: la sesión queda activa y RootNavigator muestra la app.
  };

  // If we have a token from magic link, show loading state
  if (token && type && email) {
    return (
      <View style={[styles.container, { backgroundColor: theme.crema }]}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={theme.turquesa} />
          <Text style={[styles.loadingText, { color: theme.textSecondary, marginTop: 16 }]}>
            Verificando tu cuenta...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.crema }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.azulNexo }]}>Revisa tu correo</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Te enviamos un enlace mágico a {email}.
      </Text>
      <Text style={[styles.note, { color: theme.textSecondary, marginTop: 8 }]}>
        Haz clic en el enlace para verificar tu cuenta automáticamente.
      </Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.turquesa }, loading && { opacity: 0.6 }]}
        onPress={() => {
          if (!session) {
            Alert.alert(
              'Verifica tu correo',
              'Haz clic en el enlace mágico que te enviamos para activar tu cuenta.'
            );
          }
        }}
        disabled={loading}
      >
        <Text style={[styles.buttonText, { color: theme.white }]}>Continuar a la app</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.resendButton}
        onPress={() => {
          Alert.alert('Reenviar', 'Cierra y vuelve a abrir la app para reenviar el enlace mágico.');
        }}
      >
        <Text style={[styles.resendText, { color: theme.turquesa }]}>No recibí el correo</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    marginBottom: 40,
    textAlign: 'center',
  },
  note: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
  },
  loadingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  resendButton: {
    marginTop: 16,
  },
  resendText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
});

export const styles = baseStyles;
