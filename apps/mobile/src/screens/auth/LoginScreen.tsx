import { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Button, ErrorBanner, Input } from '../../components/ui';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
}

export function LoginScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (loading) return;
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Por favor ingresa tu correo y contraseña.');
      return;
    }
    Keyboard.dismiss();
    setErrorMessage(null);
    setLoading(true);
    const { error, code } = await signIn(email.trim(), password);
    setLoading(false);
    if (code === 'email_not_confirmed') {
      navigation.navigate('VerificationCode', { email: email.trim() });
    } else if (error) {
      setErrorMessage(error);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.crema }]}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 24, 80) }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.azulNexo }]}>Bienvenida de vuelta</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Ingresa para continuar.</Text>

      <View style={styles.form}>
        <ErrorBanner message={errorMessage} />
        <Input
          label="Correo"
          placeholder="sofia@email.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => void handleLogin()}
        />

        <Input
          label="Contraseña"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          returnKeyType="go"
          onSubmitEditing={() => void handleLogin()}
        />

        <TouchableOpacity
          accessibilityRole="button"
          style={styles.forgotButton}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={[styles.forgotText, { color: theme.textAccent }]}>
            ¿Olvidaste tu contraseña?
          </Text>
        </TouchableOpacity>

        <Button
          title={loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          loading={loading}
          fullWidth
          onPress={handleLogin}
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            ¿No tienes cuenta?{' '}
            <Text style={[styles.footerLink, { color: theme.textAccent }]}>Crear cuenta</Text>
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
  form: {
    gap: 16,
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
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: -8,
  },
  forgotText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  loginButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  footerLink: {
    fontFamily: 'Inter_600SemiBold',
  },
});

export const styles = baseStyles;
