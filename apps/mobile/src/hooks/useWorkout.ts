import { useState, useCallback, useEffect } from 'react';
import { getSupabase, type Database } from '@nexofit/core';
import { holdLoading } from '../utils/loading';
import type { ExerciseLibraryItem, PersonalRecordItem, WorkoutLogItem } from '../types/screens';

// Historial del miembro: sus logs con ejercicios y series anidados.
// RLS da select de workout_* solo al dueño (o staff del org), así que
// filtrar por profile_id es redundante pero explícito.
const LOG_SELECT = `
  id,
  started_at,
  completed_at,
  status,
  notes,
  session_id,
  workout_exercises (
    id,
    order_index,
    custom_name,
    exercise_library_id,
    exercise_library ( name ),
    exercise_sets ( id, set_number, reps, weight_kg, completed )
  )
`;

const RECORD_SELECT = `
  id,
  record_type,
  value_numeric,
  unit,
  achieved_at,
  exercise_library_id,
  exercise_library ( name )
`;

interface UseWorkoutsResult {
  logs: WorkoutLogItem[];
  records: PersonalRecordItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWorkouts(profileId: string): UseWorkoutsResult {
  const [logs, setLogs] = useState<WorkoutLogItem[]>([]);
  const [records, setRecords] = useState<PersonalRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const startedAt = Date.now();
    setLoading(true);
    setError(null);

    try {
      if (!profileId) {
        setLogs([]);
        setRecords([]);
        return;
      }

      const supabase = getSupabase();
      const [logsRes, recordsRes] = await Promise.all([
        supabase
          .from('workout_logs')
          .select(LOG_SELECT)
          .eq('profile_id', profileId)
          .order('started_at', { ascending: false })
          .limit(30),
        supabase
          .from('personal_records')
          .select(RECORD_SELECT)
          .eq('profile_id', profileId)
          .order('achieved_at', { ascending: false })
          .limit(20),
      ]);

      if (logsRes.error) {
        setError(logsRes.error.message);
        setLogs([]);
      } else {
        setLogs((logsRes.data ?? []) as unknown as WorkoutLogItem[]);
      }

      if (recordsRes.error) {
        setError(recordsRes.error.message);
      } else {
        setRecords((recordsRes.data ?? []) as unknown as PersonalRecordItem[]);
      }
    } finally {
      // Transición suave: el spinner se ve siempre al menos MIN_LOADING_MS.
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { logs, records, loading, error, refresh: fetchData };
}

/** Biblioteca de ejercicios del org (para el selector del formulario). */
export async function fetchExerciseLibrary(
  organizationId: string
): Promise<{ data: ExerciseLibraryItem[]; error?: string }> {
  if (!organizationId) return { data: [], error: 'Sin gimnasio asociado.' };

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('exercise_library')
    .select('id, name, category, primary_muscle')
    .eq('organization_id', organizationId)
    .order('name');

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as ExerciseLibraryItem[] };
}

/** Programa (entrenamiento) publicado por el coach para una sesión. */
export async function fetchSessionProgram(
  sessionId: string
): Promise<{ id: string; content: string } | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('workout_programs')
    .select('id, content')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) return null;
  return data;
}

export interface WorkoutSetInput {
  reps: number | null;
  weightKg: number | null;
}

export interface WorkoutExerciseInput {
  exerciseLibraryId: string | null;
  customName: string | null;
  sets: WorkoutSetInput[];
}

export interface SaveWorkoutInput {
  organizationId: string;
  profileId: string;
  sessionId?: string | null;
  workoutProgramId?: string | null;
  startedAt: string;
  notes?: string | null;
  exercises: WorkoutExerciseInput[];
}

/**
 * Guarda el entrenamiento completo (log + ejercicios + series) en una sola
 * inserción anidada: PostgREST la ejecuta en una transacción, así que no
 * quedan logs vacíos a medias si algo falla.
 */
export async function saveWorkout(
  input: SaveWorkoutInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();

  // Construir el payload aparte: el insert acepta la relación anidada
  // workout_exercises (y exercise_sets dentro) aunque no esté en el tipo
  // Insert de workout_logs (el literal no es fresh al pasarse como variable).
  const payload = {
    organization_id: input.organizationId,
    profile_id: input.profileId,
    session_id: input.sessionId ?? null,
    workout_program_id: input.workoutProgramId ?? null,
    status: 'completed',
    started_at: input.startedAt,
    completed_at: new Date().toISOString(),
    notes: input.notes?.trim() ? input.notes.trim() : null,
    workout_exercises: input.exercises.map((ex, index) => ({
      exercise_library_id: ex.exerciseLibraryId,
      custom_name: ex.exerciseLibraryId ? null : (ex.customName ?? null),
      order_index: index,
      exercise_sets: ex.sets.map((set, setIndex) => ({
        set_number: setIndex + 1,
        reps: set.reps,
        weight_kg: set.weightKg,
        completed: true,
      })),
    })),
  };

  // Cast: el tipo Insert solo conoce columnas planas, pero PostgREST acepta
  // la relación anidada workout_exercises (con exercise_sets dentro) y la
  // ejecuta en una transacción — así no queda un log vacío a medias si algo
  // falla entre medio.
  const { data, error } = await supabase
    .from('workout_logs')
    .insert(payload as Database['public']['Tables']['workout_logs']['Insert'])
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };

  // Récords personales: mejor esfuerzo (best-effort). Un fallo aquí no
  // debe echar para atrás un entrenamiento ya guardado.
  const logId = (data as { id: string }).id;
  await syncPersonalRecords(input, logId);

  return { success: true };
}

/** Compara el máximo peso de cada ejercicio con tus récords y guarda los nuevos. */
async function syncPersonalRecords(input: SaveWorkoutInput, workoutLogId: string): Promise<void> {
  try {
    const candidates = input.exercises
      .filter((ex) => ex.exerciseLibraryId && ex.sets.length > 0)
      .map((ex) => ({
        exerciseId: ex.exerciseLibraryId as string,
        maxWeight: Math.max(...ex.sets.map((s) => s.weightKg ?? 0)),
      }))
      .filter((c) => c.maxWeight > 0);

    if (candidates.length === 0) return;

    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from('personal_records')
      .select('exercise_library_id, value_numeric')
      .eq('profile_id', input.profileId)
      .eq('record_type', 'max_weight')
      .in(
        'exercise_library_id',
        candidates.map((c) => c.exerciseId)
      );

    const current = new Map(
      (existing ?? []).map((r) => [r.exercise_library_id, Number(r.value_numeric)])
    );

    const rows = candidates
      .filter((c) => c.maxWeight > (current.get(c.exerciseId) ?? 0))
      .map((c) => ({
        organization_id: input.organizationId,
        profile_id: input.profileId,
        exercise_library_id: c.exerciseId,
        record_type: 'max_weight',
        value_numeric: c.maxWeight,
        unit: 'kg',
        workout_log_id: workoutLogId,
        achieved_at: input.startedAt,
      }));

    if (rows.length > 0) {
      await supabase.from('personal_records').insert(rows);
    }
  } catch {
    // Best-effort: el entrenamiento ya quedó guardado.
  }
}
