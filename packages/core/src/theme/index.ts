import { colors } from './colors';
import { fonts, fontSizes } from './typography';
import { radius, shadow, spacing } from './layout';

export const theme = {
  colors,
  fonts,
  fontSizes,
  spacing,
  radius,
  shadow,
} as const;

export type Theme = typeof theme;
