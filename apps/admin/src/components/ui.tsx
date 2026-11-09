import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
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

export function StatCard({
  label,
  value,
  hint,
  change,
  changeTone = 'neutral',
  onPress,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Variación vs. el periodo anterior («+12 % vs oct»). */
  change?: string | null;
  changeTone?: 'good' | 'bad' | 'neutral';
  /** Si existe, la tarjeta lleva al listado correspondiente. */
  onPress?: () => void;
}) {
  const changeColor =
    changeTone === 'good'
      ? colors.textSuccess
      : changeTone === 'bad'
        ? colors.textError
        : colors.textSecondary;
  return (
    <TouchableOpacity
      style={styles.statCard}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
      accessibilityRole={onPress ? 'link' : undefined}
      accessibilityLabel={`${label}: ${value}`}
    >
      <View style={styles.statTop}>
        <Text style={styles.statLabel}>{label}</Text>
        {onPress && <Text style={styles.statArrow}>→</Text>}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {change ? <Text style={[styles.statHint, { color: changeColor }]}>{change}</Text> : null}
      {hint !== undefined && <Text style={styles.statHint}>{hint}</Text>}
    </TouchableOpacity>
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
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  const isGhost = variant === 'ghost';
  return (
    <TouchableOpacity
      style={[
        styles.button,
        isGhost && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        disabled && styles.buttonDisabled,
      ]}
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
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textPlaceholder}
        accessibilityLabel={label}
        {...inputProps}
      />
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

/** Menos de 768 px: tablas → tarjetas apiladas, paneles a pantalla completa. */
export function useNarrow(): boolean {
  return useWindowDimensions().width < 768;
}

/** Chips de filtro (una opción activa). */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(option.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Confirmación dentro de la consola (antes window.confirm del navegador).
 * `destructive` pinta el botón principal en rojo.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.dialog} accessibilityRole="alert">
          <Text style={styles.dialogTitle}>{title}</Text>
          <Text style={styles.dialogMessage}>{message}</Text>
          <View style={styles.dialogActions}>
            <Button label="Cancelar" variant="ghost" onPress={onCancel} disabled={busy} />
            <Button
              label={busy ? 'Guardando…' : confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              disabled={busy}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Panel lateral (detalle); en pantallas angostas ocupa todo el ancho. */
export function SidePanel({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const narrow = useNarrow();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.panelOverlay}>
        <TouchableOpacity
          style={styles.panelBackdrop}
          onPress={onClose}
          accessibilityLabel="Cerrar panel"
          activeOpacity={1}
        />
        <View style={[styles.panel, narrow && styles.panelNarrow]}>
          <View style={styles.panelHeader}>
            <Text style={styles.dialogTitle}>{title}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Text style={styles.panelClose}>Cerrar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.panelBody}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
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
    borderColor: colors.border,
  },
  statCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 180,
    flex: 1,
    gap: 6,
  },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statArrow: { fontFamily: fonts.uiSemiBold, fontSize: 14, color: colors.textAccent },
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
    borderColor: colors.borderStrong,
  },
  buttonDanger: { backgroundColor: colors.textError },
  buttonDisabled: { opacity: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.textAccent, borderColor: colors.textAccent },
  chipText: { fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.azulNexo },
  chipTextActive: { color: colors.white },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  dialogTitle: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
  dialogMessage: { fontFamily: fonts.uiRegular, fontSize: 14, color: colors.textSecondary },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  panelOverlay: { flex: 1, flexDirection: 'row', backgroundColor: colors.overlay },
  panelBackdrop: { flex: 1 },
  panel: { width: 440, backgroundColor: colors.crema, height: '100%' },
  panelNarrow: { width: '100%' },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  panelClose: { fontFamily: fonts.uiSemiBold, fontSize: 14, color: colors.textAccent },
  panelBody: { padding: 20, gap: 16 },
  buttonText: { fontFamily: fonts.uiSemiBold, fontSize: 14, color: colors.crema },
  buttonTextGhost: { color: colors.azulNexo },
  field: { gap: 6 },
  fieldLabel: { fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.azulNexo },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
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
