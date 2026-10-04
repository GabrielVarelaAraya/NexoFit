import { useState, type ReactNode } from 'react';
import { ThemeContext } from './ThemeContext';
import { defaultTheme } from './defaultTheme';
import type { MutableTheme } from './defaultTheme';

interface ThemeProviderProps {
  children?: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme] = useState<MutableTheme>({ ...defaultTheme });

  // La tabla organizations no tiene columnas de configuración de tema
  // (ni theme_config ni colores), así que se usa siempre el tema por defecto.
  return (
    <ThemeContext.Provider value={theme as typeof defaultTheme}>{children}</ThemeContext.Provider>
  );
}
