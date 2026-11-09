import { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, textStyles, useTheme } from '@nexofit/core';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Button, ErrorBanner, Input } from '../../components/ui';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { setSignupIntent } from '../../utils/signupIntent';
import {
  USAGE_OPTIONS,
  intentForUsage,
  signupPasswordChecks,
  type Usage,
} from '../../utils/signup';
import { AuthBackButton } from './AuthBackButton';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;
}

export function SignUpScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const [usage, setUsage] = useState<Usage>('member');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const checks = signupPasswordChecks(password);
  const selectedUsage = USAGE_OPTIONS.find((option) => option.id === usage);

  const goBack = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Welcome');

  const handleSignUp = async () => {
    if (loading) return;
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMessage('Por favor completa todos los campos.');
      return;
    }
    if (!checks.every((check) => check.ok)) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    // El tipo de uso decide qué ofrece Inicio sin gimnasio (registrar uno o buscarlo).
    setSignupIntent(intentForUsage(usage));
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
      <AuthBackButton onPress={goBack} />
      <Text style={[styles.title, { color: theme.azulNexo }]}>Crea tu cuenta</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Regístrate para comenzar.
      </Text>

      <View style={styles.form}>
        <ErrorBanner message={errorMessage} />

        <View style={styles.usageGroup} accessibilityRole="radiogroup">
          <Text style={styles.usageLabel}>¿Cómo usarás NexoFit?</Text>
          {USAGE_OPTIONS.map((option) => {
            const selected = option.id === usage;
            return (
              <TouchableOpacity
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[styles.usageOption, selected && styles.usageOptionSelected]}
                onPress={() => setUsage(option.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={option.icon}
                  size={20}
                  color={selected ? colors.textAccent : colors.textSecondary}
                />
                <Text style={[styles.usageText, selected && styles.usageTextSelected]}>
                  {option.label}
                </Text>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selected ? colors.textAccent : colors.borderStrong}
                />
              </TouchableOpacity>
            );
          })}
          {selectedUsage?.hint ? <Text style={styles.usageHint}>{selectedUsage.hint}</Text> : null}
        </View>

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
          returnKeyType="go"
          onSubmitEditing={() => void handleSignUp()}
        />
        <View style={styles.checks}>
          {checks.map((check) => (
            <View key={check.label} style={styles.check}>
              <Ionicons
                name={check.ok ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={check.ok ? colors.textSuccess : colors.textSecondary}
              />
              <Text style={[styles.checkText, check.ok && styles.checkTextOk]}>{check.label}</Text>
            </View>
          ))}
        </View>

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
  usageGroup: { gap: 8 },
  usageLabel: { ...textStyles.bodyStrong, color: colors.azulNexo },
  usageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  usageOptionSelected: {
    borderColor: colors.textAccent,
    backgroundColor: colors.textAccent + '0D',
  },
  usageText: { ...textStyles.body, color: colors.azulNexo, flex: 1 },
  usageTextSelected: { fontFamily: textStyles.bodyStrong.fontFamily },
  usageHint: { ...textStyles.caption, color: colors.textSecondary },
  checks: { gap: 4, marginTop: -8 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkText: { ...textStyles.caption, color: colors.textSecondary },
  checkTextOk: { color: colors.textSuccess },
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
