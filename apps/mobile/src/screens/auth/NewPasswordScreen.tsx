import { useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useTheme } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { AuthStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'NewPassword'>;
  route: RouteProp<AuthStackParamList, 'NewPassword'>;
}

export function NewPasswordScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { verifyOtp, session } = useAuth();
  const { token, type, email } = route.params;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const passwordValid = hasMinLength && hasUpperCase;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  // If we have a session (from deep link), we can update password directly
  // Otherwise we need to verify the OTP first
  const handleSave = async () => {
    if (!passwordValid) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres y una mayúscula.');
      return;
    }
    if (!passwordsMatch) {
      Alert.alert('Error', 'Las contraseñas no coinciden.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);

    // If we have a token but no session, verify OTP first
    if (token && type && email && !session) {
      const { error } = await verifyOtp(email, token, type);
      if (error) {
        Alert.alert('Error', error);
        setLoading(false);
        return;
      }
    }

    // Update password (requires authenticated session)
    const supabase = (await import('@nexofit/core')).getSupabase();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      navigation.navigate('Login');
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.crema }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.azulNexo }]}>Crea una nueva contraseña</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Usa al menos 8 caracteres.
      </Text>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.azulNexo }]}>Nueva contraseña</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.white,
                borderColor: theme.azulNexo + '20',
                color: theme.azulNexo,
              },
            ]}
            placeholder="••••••••"
            placeholderTextColor={theme.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.azulNexo }]}>Confirmar contraseña</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.white,
                borderColor: theme.azulNexo + '20',
                color: theme.azulNexo,
              },
            ]}
            placeholder="••••••••"
            placeholderTextColor={theme.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        <View style={styles.requirements}>
          <View style={styles.requirement}>
            <Text
              style={[
                styles.requirementIcon,
                { color: hasMinLength ? theme.turquesa : theme.textSecondary },
              ]}
            >
              {hasMinLength ? '✓' : '○'}
            </Text>
            <Text
              style={[
                styles.requirementText,
                { color: hasMinLength ? theme.turquesa : theme.textSecondary },
              ]}
            >
              8+ caracteres
            </Text>
          </View>
          <View style={styles.requirement}>
            <Text
              style={[
                styles.requirementIcon,
                { color: hasUpperCase ? theme.turquesa : theme.textSecondary },
              ]}
            >
              {hasUpperCase ? '✓' : '○'}
            </Text>
            <Text
              style={[
                styles.requirementText,
                { color: hasUpperCase ? theme.turquesa : theme.textSecondary },
              ]}
            >
              una mayúscula
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor:
              passwordValid && passwordsMatch ? theme.turquesa : theme.turquesa + '60',
          },
        ]}
        onPress={handleSave}
        disabled={!passwordValid || !passwordsMatch || loading}
      >
        <Text style={[styles.buttonText, { color: theme.white }]}>
          {loading ? 'Guardando...' : 'Guardar contraseña'}
        </Text>
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
  requirements: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 8,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementIcon: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  requirementText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
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
});

export const styles = baseStyles;
