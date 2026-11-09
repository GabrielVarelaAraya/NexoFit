import type { WorkoutLogItem } from '../types/screens';

/** Ejercicio listo para precargar el formulario (valores como texto, igual que los inputs). */
export interface CopiedExercise {
  libraryId: string | null;
  name: string;
  sets: { reps: string; weight: string }[];
}

/**
 * Convierte un entrenamiento ya registrado en la plantilla de uno nuevo:
 * mismos ejercicios, series, repeticiones y pesos (sin fecha ni notas).
 */
export function copyExercisesFromLog(log: WorkoutLogItem): CopiedExercise[] {
  return [...(log.workout_exercises ?? [])]
    .sort((a, b) => a.order_index - b.order_index)
    .map((ex) => ({
      libraryId: ex.exercise_library_id,
      name: ex.exercise_library?.name ?? ex.custom_name ?? 'Ejercicio',
      sets: [...(ex.exercise_sets ?? [])]
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({
          reps: s.reps != null ? String(s.reps) : '',
          weight: s.weight_kg != null ? String(Number(s.weight_kg)) : '',
        })),
    }))
    .filter((ex) => ex.sets.length > 0);
}
