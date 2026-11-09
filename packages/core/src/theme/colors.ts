export const colors = {
  azulNexo: '#06354E',
  turquesa: '#0B9B91',
  mentaActiva: '#16B9A9',
  limaProgreso: '#A9F56F',
  crema: '#F8F6EF',
  white: '#FFFFFF',
  // Dark text colors for light surfaces; brand accents remain available for fills.
  textSecondary: '#475569',
  textAccent: '#08766F',
  textSuccess: '#2F6B1A',
  textError: '#B91C1C',
  textWarning: '#92400E',
  // Placeholders: claramente más tenues que un valor escrito.
  textPlaceholder: '#94A3B8',

  // --- Tokens semánticos (usar estos en vez de hex sueltos) ---
  textPrimary: '#111827',
  textBody: '#374151',
  textMuted: '#9CA3AF',
  surface: '#FFFFFF',
  surfaceMuted: '#F9FAFB',
  surfaceSubtle: '#F3F4F6',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  success: '#10B981',
  successBg: '#ECFDF5',
  overlay: 'rgba(6, 53, 78, 0.45)',
};

export const brandProportions = {
  cremaOrWhite: 0.55,
  azulNexo: 0.25,
  turquesas: 0.15,
  lima: 0.05,
} as const;
