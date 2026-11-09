export const fonts = {
  brand: 'Nunito_800ExtraBold',
  uiSemiBold: 'Inter_600SemiBold',
  uiRegular: 'Inter_400Regular',
} as const;

/**
 * Escala tipográfica: preferir estos estilos a fontSize/fontFamily sueltos.
 * Tamaños alineados con los más usados en la app (12/13/14/16/18/22/28).
 */
export const textStyles = {
  caption: { fontFamily: fonts.uiRegular, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.uiSemiBold, fontSize: 13, lineHeight: 18 },
  body: { fontFamily: fonts.uiRegular, fontSize: 14, lineHeight: 20 },
  bodyStrong: { fontFamily: fonts.uiSemiBold, fontSize: 14, lineHeight: 20 },
  bodyLg: { fontFamily: fonts.uiRegular, fontSize: 16, lineHeight: 22 },
  title: { fontFamily: fonts.uiSemiBold, fontSize: 18, lineHeight: 24 },
  h2: { fontFamily: fonts.uiSemiBold, fontSize: 22, lineHeight: 28 },
  h1: { fontFamily: fonts.brand, fontSize: 28, lineHeight: 34 },
} as const;

export type TextStyleName = keyof typeof textStyles;

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;
