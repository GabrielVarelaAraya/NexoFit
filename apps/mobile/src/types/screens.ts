import type { SessionPublic, BookingPublic } from '@nexofit/core';

export type SessionWithType = SessionPublic;
export type BookingWithSession = BookingPublic;

export interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

// ============================================================
// Stage 4 · Member workout experience
// ============================================================

export interface ExerciseSetItem {
  id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  completed: boolean;
}

export interface WorkoutExerciseItem {
  id: string;
  order_index: number;
  custom_name: string | null;
  exercise_library_id: string | null;
  exercise_library?: { name: string } | null;
  exercise_sets: ExerciseSetItem[];
}

export interface WorkoutLogItem {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  notes: string | null;
  session_id: string | null;
  workout_exercises: WorkoutExerciseItem[];
}

export interface PersonalRecordItem {
  id: string;
  record_type: string;
  value_numeric: number;
  unit: string;
  achieved_at: string;
  exercise_library_id: string;
  exercise_library?: { name: string } | null;
}

export interface ExerciseLibraryItem {
  id: string;
  name: string;
  category: string;
  primary_muscle: string | null;
}
