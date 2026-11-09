import { useState } from 'react';
import {
  TextInput,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '@nexofit/core';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, style, secureTextEntry, ...rest }: InputProps) {
  // Contraseñas: botón para mostrar/ocultar lo escrito (evita errores de tipeo).
  const [revealed, setRevealed] = useState(false);
  const isPassword = secureTextEntry === true;

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.field}>
        <TextInput
          style={[
            styles.input,
            isPassword && styles.inputWithToggle,
            error && styles.inputError,
            style,
          ]}
          placeholderTextColor={colors.textPlaceholder}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          secureTextEntry={isPassword && !revealed}
          {...rest}
        />
        {isPassword && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            style={styles.toggle}
            onPress={() => setRevealed((value) => !value)}
            hitSlop={8}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.azulNexo,
  },
  field: { position: 'relative', justifyContent: 'center' },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.uiRegular,
    fontSize: 16,
    color: colors.textPrimary,
  },
  inputWithToggle: { paddingRight: 48 },
  inputError: {
    borderColor: colors.danger,
  },
  toggle: {
    position: 'absolute',
    right: 4,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.textError,
  },
  hint: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
