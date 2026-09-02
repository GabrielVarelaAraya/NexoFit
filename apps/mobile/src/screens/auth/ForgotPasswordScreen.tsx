import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { colors, fonts } from '@nexofit/core';

interface Props {
  onBack: () => void;
}

export function ForgotPasswordScreen({ onBack }: Props) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(email.trim());
    setLoading(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      Alert.alert('Check your email', 'We sent you a password reset link.', [
        { text: 'OK', onPress: onBack },
      ]);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter your email and we'll send you a reset link</Text>

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

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleReset}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send Reset Link'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={onBack}>
          <Text style={styles.linkText}>
            <Text style={styles.linkBold}>Back to Sign In</Text>
          </Text>
        </TouchableOpacity>
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
    fontSize: 28,
    color: colors.crema,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.mentaActiva,
    textAlign: 'center',
    marginBottom: 32,
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
  button: {
    backgroundColor: colors.turquesa,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
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
