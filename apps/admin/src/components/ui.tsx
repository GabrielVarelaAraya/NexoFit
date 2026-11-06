import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, fonts } from '@nexofit/core';

// ============================================================
// UI base de la consola web (React Native Web): tarjetas,
// botones, campos y estados de carga/vacíos.
// ============================================================

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hint !== undefined && <Text style={styles.statHint}>{hint}</Text>}
    </View>
  );
}

export function Badge({
  label,
  color,
  textColor = colors.azulNexo,
}: {
  label: string;
  color: string;
  textColor?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '1F' }]}>
      <Text style={[styles.badgeText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}) {
  const isGhost = variant === 'ghost';
  return (
    <TouchableOpacity
      style={[styles.button, isGhost && styles.buttonGhost, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      <Text style={[styles.buttonText, isGhost && styles.buttonTextGhost]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Field({ label, ...inputProps }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor="#9CA3AF" {...inputProps} />
    </View>
  );
}

export function LoadingView({ label }: { label: string }) {
  return (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={colors.turquesa} />
      <Text style={styles.centerStateText}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.centerState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle !== undefined && <Text style={styles.centerStateText}>{subtitle}</Text>}
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

export const labelStyle: TextStyle = {
  fontFamily: fonts.uiSemiBold,
  fontSize: 16,
  color: colors.azulNexo,
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 180,
    flex: 1,
    gap: 6,
  },
  statLabel: { fontFamily: fonts.uiRegular, fontSize: 13, color: colors.textSecondary },
  statValue: { fontFamily: fonts.brand, fontSize: 28, color: colors.azulNexo },
  statHint: { fontFamily: fonts.uiRegular, fontSize: 12, color: colors.textSecondary },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontFamily: fonts.uiSemiBold, fontSize: 12 },
  button: {
    backgroundColor: colors.textAccent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontFamily: fonts.uiSemiBold, fontSize: 14, color: colors.crema },
  buttonTextGhost: { color: colors.azulNexo },
  field: { gap: 6 },
  fieldLabel: { fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.azulNexo },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.azulNexo,
  },
  centerState: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  centerStateText: { fontFamily: fonts.uiRegular, fontSize: 14, color: colors.textSecondary },
  emptyTitle: { fontFamily: fonts.uiSemiBold, fontSize: 16, color: colors.azulNexo },
  error: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.textError,
    textAlign: 'center',
  },
});
