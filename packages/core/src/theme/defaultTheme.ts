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
  success: colors.limaProgreso,
  warning: '#F5A623',
  error: '#E74C3C',
  info: colors.turquesa,

  // Background
  background: colors.crema,
  cardBackground: colors.white,
  textPrimary: colors.azulNexo,
  textSecondary: colors.azulNexo + 'AA',

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
