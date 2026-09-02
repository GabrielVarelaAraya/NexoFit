import { TextInput, Text, View, StyleSheet, type TextInputProps } from 'react-native';
import { colors, fonts } from '@nexofit/core';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, style, ...rest }: InputProps) {
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor="#9CA3AF"
        {...rest}
      />
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
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.uiRegular,
    fontSize: 16,
    color: '#111827',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  error: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: '#EF4444',
  },
  hint: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: '#9CA3AF',
  },
});
