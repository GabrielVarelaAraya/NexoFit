import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@nexofit/core';
import { Button, ErrorText, Field } from '../components/ui';

// Acceso a la consola: el gate de membresía admin vive en App.tsx;
// aquí solo se autentica con Supabase.
export function LoginScreen({
  onSignIn,
  accessMessage,
}: {
  onSignIn: (email: string, password: string) => Promise<string | null>;
  accessMessage?: string | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }
    setSubmitting(true);
    setError(await onSignIn(email.trim(), password));
    setSubmitting(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.brand}>NexoFit</Text>
        <Text style={styles.title}>Consola de administración</Text>
        <Text style={styles.subtitle}>Gestión de operaciones del gimnasio</Text>

        <Field
          label="Correo"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="admin@gimnasio.com"
          returnKeyType="next"
          onSubmitEditing={() => void handleSignIn()}
        />
        <Field
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          returnKeyType="go"
          onSubmitEditing={() => void handleSignIn()}
        />

        {(error ?? accessMessage) && <ErrorText>{error ?? accessMessage}</ErrorText>}

        <Button
          label={submitting ? 'Ingresando…' : 'Iniciar sesión'}
          onPress={() => void handleSignIn()}
          disabled={submitting}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.crema,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 32,
    gap: 16,
  },
  brand: {
    fontFamily: fonts.brand,
    fontSize: 26,
    color: colors.azulNexo,
    textAlign: 'center',
  },
  title: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: colors.azulNexo,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
});
