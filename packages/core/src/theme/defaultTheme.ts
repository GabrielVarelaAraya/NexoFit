import { colors } from './colors';
import { fonts, fontSizes } from './typography';
import { spacing, radius } from './layout';

export const defaultTheme = {
  // Brand colors
  azulNexo: colors.azulNexo,
  turquesa: colors.turquesa,
  mentaActiva: colors.mentaActiva,
  limaProgreso: colors.limaProgreso,
  crema: colors.crema,
  white: colors.white,

  // Semantic colors
  success: colors.textSuccess,
  warning: colors.textWarning,
  error: colors.textError,
  info: colors.textAccent,

  // Background
  background: colors.crema,
  cardBackground: colors.white,
  textPrimary: colors.azulNexo,
  textSecondary: colors.textSecondary,
  textAccent: colors.textAccent,

  // Typography
  fonts,
  fontSizes,

  // Spacing
  spacing,

  // Border radius
  radius,
} as const;

// Mutable version for theme overrides
export type MutableTheme = {
  -readonly [K in keyof typeof defaultTheme]: (typeof defaultTheme)[K];
};
