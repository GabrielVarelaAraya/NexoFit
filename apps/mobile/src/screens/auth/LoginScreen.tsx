import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { colors, fonts } from '@nexofit/core';

interface Props {
  onSwitchToSignUp: () => void;
  onSwitchToForgot: () => void;
}

export function LoginScreen({ onSwitchToSignUp, onSwitchToForgot }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) Alert.alert('Login failed', error);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>NexoFit</Text>
        <Text style={styles.tagline}>Reserva · Entrena · Progresa</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.crema + '80'}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.crema + '80'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          <TouchableOpacity style={styles.forgot} onPress={onSwitchToForgot}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={onSwitchToSignUp}>
            <Text style={styles.linkText}>
              Don't have an account? <Text style={styles.linkBold}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.azulNexo,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  title: {
    fontFamily: fonts.brand,
    fontSize: 34,
    color: colors.crema,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.mentaActiva,
    textAlign: 'center',
    marginBottom: 48,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: colors.azulNexo + 'CC',
    borderWidth: 1,
    borderColor: colors.turquesa + '40',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: fonts.uiRegular,
    fontSize: 16,
    color: colors.crema,
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  forgotText: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.turquesa,
  },
  button: {
    backgroundColor: colors.turquesa,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: colors.crema,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  linkText: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.crema,
  },
  linkBold: {
    fontFamily: fonts.uiSemiBold,
    color: colors.limaProgreso,
  },
});
