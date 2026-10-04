import { createContext, useContext } from 'react';
import { defaultTheme } from './defaultTheme';

export type Theme = typeof defaultTheme;

const ThemeContext = createContext<Theme>(defaultTheme);

ThemeContext.displayName = 'ThemeContext';

export { ThemeContext };

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
