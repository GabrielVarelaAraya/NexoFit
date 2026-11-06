import { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@nexofit/core';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Button, ErrorBanner, Input } from '../../components/ui';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;
}

export function SignUpScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignUp = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMessage('Por favor completa todos los campos.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (loading) return;
    const normalizedEmail = email.trim().toLowerCase();
    Keyboard.dismiss();
    setEmailError(null);
    setErrorMessage(null);
    setLoading(true);
    try {
      const { error, code, needsConfirmation } = await signUp(
        normalizedEmail,
        password,
        fullName.trim()
      );
      if (error) {
        if (code === 'email_exists') {
          setEmailError(error);
        } else {
          setErrorMessage(error);
        }
      } else if (needsConfirmation) {
        navigation.navigate('VerificationCode', { email: normalizedEmail });
      }
    } catch {
      setErrorMessage('No se pudo completar el registro. Inténtalo de nuevo.');
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
      <Text style={[styles.title, { color: theme.azulNexo }]}>Crea tu cuenta</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Regístrate para comenzar.
      </Text>

      <View style={styles.form}>
        <ErrorBanner message={errorMessage} />
        <Input
          label="Nombre completo"
          placeholder="Sofia Lizano"
          value={fullName}
          onChangeText={setFullName}
          autoComplete="name"
        />

        <Input
          label="Correo"
          placeholder="sofia@email.com"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setEmailError(null);
          }}
          error={emailError ?? undefined}
          editable={!loading}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Input
          label="Contraseña"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <Button
          title={loading ? 'Creando cuenta...' : 'Crear cuenta'}
          loading={loading}
          fullWidth
          onPress={handleSignUp}
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            ¿Ya tienes cuenta?{' '}
            <Text style={[styles.footerLink, { color: theme.textAccent }]}>Iniciar sesión</Text>
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
  emailError: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  signupButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  signupButtonText: {
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
