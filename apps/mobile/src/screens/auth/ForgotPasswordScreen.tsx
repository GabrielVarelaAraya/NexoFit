import { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@nexofit/core';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Button, ErrorBanner, Input } from '../../components/ui';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
}

export function ForgotPasswordScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSendCode = async () => {
    if (loading) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorMessage('Ingresa una dirección de correo válida.');
      return;
    }
    Keyboard.dismiss();
    setErrorMessage(null);
    setLoading(true);
    try {
      const { error } = await resetPassword(normalizedEmail);
      if (error) {
        setErrorMessage(error);
      } else {
        navigation.navigate('VerificationCode', { email: normalizedEmail, type: 'recovery' });
      }
    } catch {
      setErrorMessage('No pudimos enviar el código. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.crema }]}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 24, 80) }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.azulNexo }]}>Recupera tu acceso</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Si el correo está registrado, recibirás un código para recuperar tu acceso.
      </Text>

      <ErrorBanner message={errorMessage} />

      <Input
        label="Correo electrónico"
        placeholder="sofia@email.com"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />

      <View style={styles.footer}>
        <Button
          title={loading ? 'Enviando...' : 'Enviar código'}
          loading={loading}
          fullWidth
          onPress={handleSendCode}
        />

        <TouchableOpacity
          accessibilityRole="button"
          style={styles.backButton}
          onPress={() => navigation.navigate('Login')}
          disabled={loading}
        >
          <Text style={[styles.backText, { color: theme.textAccent }]}>
            Volver a iniciar sesión
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    marginBottom: 32,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    borderWidth: 1,
  },
  footer: {
    gap: 16,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
});

export const styles = baseStyles;
