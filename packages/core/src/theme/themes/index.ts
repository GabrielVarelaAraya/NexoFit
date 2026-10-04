export const themePresets = {
  // NexoFit Default
  nexofit: {
    name: 'NexoFit',
    primary_color: '#06354E',
    secondary_color: '#0B9B91',
    background_color: '#F8F6EF',
    card_background: '#FFFFFF',
    style: 'default' as const,
  },

  // IRONBOX - CrossFit/High Intensity (Red/orange accent, dark header)
  ironbox: {
    name: 'IRONBOX',
    primary_color: '#1A1A1A',
    secondary_color: '#FF4444',
    background_color: '#F5F5F5',
    card_background: '#FFFFFF',
    style: 'energetico' as const,
  },

  // ALMA YOGA - Yoga/Pilates (Olive/sage green, minimal)
  almayoga: {
    name: 'ALMA YOGA',
    primary_color: '#5C6B4F',
    secondary_color: '#8B9A6B',
    background_color: '#F8F6EF',
    card_background: '#FFFFFF',
    style: 'minimal' as const,
  },

  // PULSE GYM - Modern Tech (Blue/cyan, electric)
  pulsegym: {
    name: 'PULSE GYM',
    primary_color: '#0A1628',
    secondary_color: '#00D4FF',
    background_color: '#F0F4F8',
    card_background: '#FFFFFF',
    style: 'tecnologico' as const,
  },

  // SERENITY SPA - Premium Wellness (Purple/mauve, sophisticated)
  serenity: {
    name: 'SERENITY SPA',
    primary_color: '#2D1B3D',
    secondary_color: '#9B6B9B',
    background_color: '#FAF8FC',
    card_background: '#FFFFFF',
    style: 'elegante' as const,
  },
} as const;

export type ThemePreset = keyof typeof themePresets;
export type ThemeStyle = 'default' | 'energetico' | 'minimal' | 'tecnologico' | 'elegante';
