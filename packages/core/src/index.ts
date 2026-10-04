export * from './types/domain';

export * from './theme/colors';
export * from './theme/typography';
export * from './theme/layout';
export * from './theme/index';
export { ThemeProvider } from './theme/ThemeProvider';
export { useTheme } from './theme/ThemeContext';
export type { Theme } from './theme/ThemeContext';
export { themePresets } from './theme/themes';
export type { ThemePreset, ThemeStyle } from './theme/themes';

export { getSupabase, setSupabaseConfig } from './supabase/client';
export type { Database } from './supabase/database.types';
export type {
  MeasurementRow,
  MeasurementValueRow,
  ExerciseLibraryRow,
  WorkoutLogRow,
  WorkoutExerciseRow,
  ExerciseSetRow,
  PersonalRecordRow,
  WorkoutTemplateRow,
  WorkoutTemplateExerciseRow,
} from './supabase/database.types';
