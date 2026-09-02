import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  type TouchableOpacityProps,
} from 'react-native';
import { colors, fonts } from '@nexofit/core';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  title,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const variantStyles = variants[variant];

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantStyles.container,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyles.textColor} />
      ) : (
        <Text style={[styles.text, { color: variantStyles.textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const variants: Record<ButtonVariant, { container: object; textColor: string }> = {
  primary: {
    container: { backgroundColor: colors.turquesa },
    textColor: colors.crema,
  },
  secondary: {
    container: { backgroundColor: colors.azulNexo },
    textColor: colors.crema,
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.turquesa },
    textColor: colors.turquesa,
  },
  danger: {
    container: { backgroundColor: '#E74C3C' },
    textColor: colors.crema,
  },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
  },
});
