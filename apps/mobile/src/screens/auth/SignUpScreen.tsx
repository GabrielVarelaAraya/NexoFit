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
import type { AuthStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;
}

export function SignUpScreen({ navigation }: Props) {
  const theme = useTheme();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    const { error } = await signUp(email.trim(), password, fullName.trim());
    setLoading(false);
    if (error) {
      Alert.alert('Error de registro', error);
    } else {
      navigation.navigate('VerificationCode', { email: email.trim() });
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.crema }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.azulNexo }]}>Crea tu cuenta</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Regístrate para comenzar.
      </Text>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.azulNexo }]}>Nombre completo</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.white,
                borderColor: theme.azulNexo + '20',
                color: theme.azulNexo,
              },
            ]}
            placeholder="Sofia Lizano"
            placeholderTextColor={theme.textSecondary}
            value={fullName}
            onChangeText={setFullName}
            autoComplete="name"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.azulNexo }]}>Correo</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.white,
                borderColor: theme.azulNexo + '20',
                color: theme.azulNexo,
              },
            ]}
            placeholder="sofia@email.com"
            placeholderTextColor={theme.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.azulNexo }]}>Contraseña</Text>
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
            autoComplete="new-password"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.signupButton,
            { backgroundColor: theme.turquesa },
            loading && { opacity: 0.6 },
          ]}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text style={[styles.signupButtonText, { color: theme.white }]}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </Text>
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={[styles.divider, { backgroundColor: theme.azulNexo + '20' }]} />
          <Text style={[styles.dividerText, { color: theme.textSecondary }]}>o</Text>
          <View style={[styles.divider, { backgroundColor: theme.azulNexo + '20' }]} />
        </View>

        <TouchableOpacity
          style={[
            styles.socialButton,
            { backgroundColor: theme.white, borderColor: theme.azulNexo + '20' },
          ]}
          activeOpacity={0.7}
        >
          <Text style={[styles.socialButtonText, { color: theme.azulNexo }]}>
            Continuar con Google
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.socialButton, { backgroundColor: theme.azulNexo }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.socialButtonText, { color: theme.white }]}>Continuar con Apple</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            ¿Ya tienes cuenta?{' '}
            <Text style={[styles.footerLink, { color: theme.turquesa }]}>Iniciar sesión</Text>
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
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginHorizontal: 16,
  },
  socialButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  socialButtonText: {
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
