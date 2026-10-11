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
import { Button } from '../../components/ui/Button';

export function NewPasswordScreen() {
  const theme = useTheme();
  const { updatePassword, finishPasswordRecovery, cancelPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [saved, setSaved] = useState(false);
  const busy = loading || cancelling;

  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const passwordValid = hasMinLength && hasUpperCase;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSave = async () => {
    if (loading || cancelling || saved) return;
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
    try {
      const { error } = await updatePassword(password);
      if (error) {
        Alert.alert('No se pudo cambiar la contraseña', error);
      } else {
        setPassword('');
        setConfirmPassword('');
        setSaved(true);
      }
    } catch {
      Alert.alert('Sin conexión', 'No pudimos guardar la contraseña. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (loading || cancelling) return;
    setCancelling(true);
    try {
      const { error } = await cancelPasswordRecovery();
      if (error) Alert.alert('No se pudo salir', error);
    } catch {
      Alert.alert('Sin conexión', 'No pudimos cerrar la recuperación. Inténtalo de nuevo.');
    } finally {
      setCancelling(false);
    }
  };

  if (saved) {
    return (
      <View style={[styles.container, styles.content, { backgroundColor: theme.crema }]}>
        <Text style={[styles.title, { color: theme.azulNexo }]}>Contraseña actualizada</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Tu contraseña nueva se guardó correctamente. Puedes continuar en NexoFit.
        </Text>
        <Button title="Entrar a NexoFit" onPress={finishPasswordRecovery} fullWidth />
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
      <Text style={[styles.title, { color: theme.azulNexo }]}>Crea una nueva contraseña</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Usa al menos 8 caracteres y una mayúscula.
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
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!busy}
            accessibilityLabel="Nueva contraseña"
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
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!busy}
            accessibilityLabel="Confirmar contraseña"
          />
        </View>

        <View style={styles.requirements}>
          <View style={styles.requirement}>
            <Text
              style={[
                styles.requirementIcon,
                { color: hasMinLength ? theme.textAccent : theme.textSecondary },
              ]}
            >
              {hasMinLength ? '✓' : '○'}
            </Text>
            <Text
              style={[
                styles.requirementText,
                { color: hasMinLength ? theme.textAccent : theme.textSecondary },
              ]}
            >
              8+ caracteres
            </Text>
          </View>
          <View style={styles.requirement}>
            <Text
              style={[
                styles.requirementIcon,
                { color: hasUpperCase ? theme.textAccent : theme.textSecondary },
              ]}
            >
              {hasUpperCase ? '✓' : '○'}
            </Text>
            <Text
              style={[
                styles.requirementText,
                { color: hasUpperCase ? theme.textAccent : theme.textSecondary },
              ]}
            >
              una mayúscula
            </Text>
          </View>
        </View>
      </View>

      <Button
        title={loading ? 'Guardando...' : 'Guardar contraseña'}
        onPress={handleSave}
        loading={loading}
        disabled={!passwordValid || !passwordsMatch || busy}
        fullWidth
        style={{ marginTop: 24 }}
      />
      <TouchableOpacity style={styles.backButton} onPress={handleCancel} disabled={busy}>
        <Text style={[styles.buttonText, { color: theme.textAccent }]}>
          {cancelling ? 'Saliendo...' : 'Cancelar recuperación'}
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
  backButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
});

export const styles = baseStyles;
