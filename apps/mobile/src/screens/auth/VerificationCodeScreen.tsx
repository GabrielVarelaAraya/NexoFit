import { useState, useEffect } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

export function VerificationCodeScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { verifyOtp, resendVerificationEmail, resetPassword } = useAuth();
  const { email, token, type = 'signup' } = route.params;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(Boolean(token));
  const [resending, setResending] = useState(false);
  const [resendWait, setResendWait] = useState(type === 'recovery' ? 60 : 0);
  const busy = loading || resending;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    verifyOtp(email, token, type)
      .then(({ error }) => {
        if (!cancelled && error) Alert.alert('No se pudo verificar', error);
      })
      .catch(() => {
        if (!cancelled) Alert.alert('Sin conexión', 'Inténtalo de nuevo cuando tengas conexión.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [email, token, type, verifyOtp]);

  useEffect(() => {
    if (resendWait <= 0) return;
    const timeout = setTimeout(() => setResendWait((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timeout);
  }, [resendWait]);

  const handleVerify = async () => {
    if (busy) return;
    if (!code.trim()) {
      Alert.alert('Falta el código', 'Ingresa el código que aparece en tu correo.');
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    try {
      const { error } = await verifyOtp(email, code.trim(), type);
      if (error) Alert.alert('No se pudo verificar', error);
      // RootNavigator abre Nueva contraseña para recovery, o la app para signup.
    } catch {
      Alert.alert('Sin conexión', 'Inténtalo de nuevo cuando tengas conexión.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (busy || resendWait > 0) return;
    Keyboard.dismiss();
    setResending(true);
    try {
      const { error } =
        type === 'recovery' ? await resetPassword(email) : await resendVerificationEmail(email);
      if (error) {
        Alert.alert('No se pudo reenviar', error);
      } else {
        setCode('');
        setResendWait(60);
        Alert.alert(
          'Solicitud enviada',
          'Revisa tu bandeja de entrada y spam. Usa el código más reciente.'
        );
      }
    } catch {
      Alert.alert('Sin conexión', 'No pudimos enviar el correo. Inténtalo de nuevo.');
    } finally {
      setResending(false);
    }
  };

  if (token && loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.crema }]}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={theme.turquesa} />
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            Verificando el código...
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
        {type === 'signup'
          ? 'Confirma tu cuenta con el correo enviado a '
          : 'Si el correo está registrado, enviamos un código de recuperación a '}
        {email}.
      </Text>

      <>
        <Text style={[styles.label, { color: theme.azulNexo }]}>
          {type === 'recovery' ? 'Código de recuperación' : 'Código de confirmación'}
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.white,
              borderColor: theme.azulNexo + '20',
              color: theme.azulNexo,
            },
          ]}
          accessibilityLabel={
            type === 'recovery' ? 'Código de recuperación' : 'Código de confirmación'
          }
          placeholder="Código del correo"
          placeholderTextColor={theme.textSecondary}
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={10}
          editable={!busy}
          onSubmitEditing={handleVerify}
        />
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          {type === 'recovery'
            ? 'Introduce el código del correo más reciente para crear una contraseña nueva.'
            : 'Usa el código del correo más reciente. Si ya confirmaste con el enlace, puedes iniciar sesión.'}
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.textAccent }, busy && { opacity: 0.6 }]}
          onPress={handleVerify}
          disabled={busy}
        >
          <Text style={[styles.buttonText, { color: theme.white }]}>
            {loading
              ? 'Verificando...'
              : type === 'recovery'
                ? 'Verificar código'
                : 'Confirmar correo'}
          </Text>
        </TouchableOpacity>
      </>

      <TouchableOpacity
        style={[styles.resendButton, (busy || resendWait > 0) && { opacity: 0.6 }]}
        onPress={handleResend}
        disabled={busy || resendWait > 0}
      >
        <Text style={[styles.resendText, { color: theme.textAccent }]}>
          {resending
            ? 'Enviando...'
            : resendWait > 0
              ? 'Reenviar en ' + resendWait + ' s'
              : 'Reenviar correo'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.resendButton}
        onPress={() => navigation.navigate('Login')}
        disabled={busy}
      >
        <Text style={[styles.resendText, { color: theme.textAccent }]}>
          Volver a iniciar sesión
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    alignSelf: 'flex-start',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontFamily: 'Inter_400Regular',
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 3,
  },
  note: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 16,
  },
  button: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  resendButton: {
    paddingVertical: 12,
    marginTop: 8,
  },
  resendText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textAlign: 'center',
  },
});
