import { useState, useCallback, useEffect } from 'react';
import { getSupabase } from '@nexofit/core';
import { holdLoading } from '../utils/loading';
import { friendlyError } from '../utils/errors';
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
          // Solo guardados completos: un log a medias (in_progress/cancelled) no cuenta.
          .eq('status', 'completed')
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
        setError(friendlyError(logsRes.error, 'No se pudo cargar tu historial de entrenamientos.'));
        setLogs([]);
      } else {
        setLogs((logsRes.data ?? []) as unknown as WorkoutLogItem[]);
      }

      if (recordsRes.error) {
        setError(friendlyError(recordsRes.error, 'No se pudieron cargar tus récords personales.'));
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

  if (error) {
    return {
      data: [],
      error: friendlyError(error, 'No se pudo cargar la biblioteca de ejercicios.'),
    };
  }
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

type Client = ReturnType<typeof getSupabase>;

/** Filas de workout_exercises (planas) para un log recién creado. */
export function buildExerciseRows(workoutLogId: string, exercises: WorkoutExerciseInput[]) {
  return exercises.map((ex, index) => ({
    workout_log_id: workoutLogId,
    exercise_library_id: ex.exerciseLibraryId,
    custom_name: ex.exerciseLibraryId ? null : (ex.customName ?? null),
    order_index: index,
  }));
}

/**
 * Filas de exercise_sets (planas). `idByOrder` relaciona el order_index de cada
 * ejercicio con el id que devolvió la base de datos al insertarlo.
 */
export function buildSetRows(
  idByOrder: ReadonlyMap<number, string>,
  exercises: WorkoutExerciseInput[]
) {
  return exercises.flatMap((ex, index) => {
    const workoutExerciseId = idByOrder.get(index);
    if (!workoutExerciseId) return [];
    return ex.sets.map((set, setIndex) => ({
      workout_exercise_id: workoutExerciseId,
      set_number: setIndex + 1,
      reps: set.reps,
      weight_kg: set.weightKg,
      completed: true,
    }));
  });
}

/**
 * Guarda el entrenamiento completo (log + ejercicios + series).
 *
 * PostgREST NO admite inserciones anidadas (mandar `workout_exercises` dentro
 * del insert de `workout_logs` falla con «Could not find the 'workout_exercises'
 * column»), así que se hace en pasos planos. Como `workout_logs` no tiene
 * política de DELETE para deshacer un guardado a medias, el estado del log
 * hace de marca de commit: nace `in_progress`, y solo pasa a `completed` cuando
 * ejercicios y series ya están guardados. Si algo falla en medio queda
 * `cancelled` y el historial (que solo muestra `completed`) no lo ve.
 */
export async function saveWorkoutWithClient(
  supabase: Client,
  input: SaveWorkoutInput
): Promise<{ success: boolean; error?: string }> {
  const { data: log, error: logError } = await supabase
    .from('workout_logs')
    .insert({
      organization_id: input.organizationId,
      profile_id: input.profileId,
      session_id: input.sessionId ?? null,
      workout_program_id: input.workoutProgramId ?? null,
      status: 'in_progress',
      started_at: input.startedAt,
      notes: input.notes?.trim() ? input.notes.trim() : null,
    })
    .select('id')
    .single();

  if (logError || !log) {
    // Detalle crudo solo en consola; la pantalla muestra su propio copy.
    console.warn('save workout log failed', logError?.message);
    return { success: false };
  }
  const logId = (log as { id: string }).id;

  const abandon = async (step: string, message?: string) => {
    console.warn(`save workout ${step} failed`, message);
    // Mejor esfuerzo: el log ya no cuenta, pero no se puede borrar (sin DELETE en RLS).
    await supabase.from('workout_logs').update({ status: 'cancelled' }).eq('id', logId);
    return { success: false } as const;
  };

  const exerciseRows = buildExerciseRows(logId, input.exercises);
  const idByOrder = new Map<number, string>();
  if (exerciseRows.length > 0) {
    const { data: inserted, error: exercisesError } = await supabase
      .from('workout_exercises')
      .insert(exerciseRows)
      .select('id, order_index');
    if (exercisesError || !inserted) return abandon('exercises', exercisesError?.message);
    for (const row of inserted) idByOrder.set(row.order_index, row.id);
  }

  const setRows = buildSetRows(idByOrder, input.exercises);
  if (setRows.length > 0) {
    const { error: setsError } = await supabase.from('exercise_sets').insert(setRows);
    if (setsError) return abandon('sets', setsError.message);
  }

  // Todo guardado: ahora sí el entrenamiento cuenta.
  const { error: completeError } = await supabase
    .from('workout_logs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', logId);
  if (completeError) return abandon('complete', completeError.message);

  // Récords personales: mejor esfuerzo (best-effort). Un fallo aquí no
  // debe echar para atrás un entrenamiento ya guardado.
  await syncPersonalRecords(supabase, input, logId);

  return { success: true };
}

/**
 * Borra un entrenamiento registrado (sus ejercicios y series caen en cascada).
 * Si la base aún no tiene la política de DELETE (migración 000009) PostgREST
 * responde sin error pero sin borrar nada; en ese caso se marca `cancelled`,
 * que lo oculta del historial.
 */
export async function deleteWorkoutWithClient(
  supabase: Client,
  logId: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.from('workout_logs').delete().eq('id', logId).select('id');
  if (!error && data && data.length > 0) return { success: true };
  if (error) console.warn('delete workout failed', error.message);

  const { data: hidden, error: hideError } = await supabase
    .from('workout_logs')
    .update({ status: 'cancelled' })
    .eq('id', logId)
    .select('id');
  if (hideError || !hidden || hidden.length === 0) {
    console.warn('hide workout failed', hideError?.message);
    return { success: false };
  }
  return { success: true };
}

export function deleteWorkout(logId: string): Promise<{ success: boolean; error?: string }> {
  return deleteWorkoutWithClient(getSupabase(), logId);
}

export function saveWorkout(
  input: SaveWorkoutInput
): Promise<{ success: boolean; error?: string }> {
  return saveWorkoutWithClient(getSupabase(), input);
}

/** Compara el máximo peso de cada ejercicio con tus récords y guarda los nuevos. */
async function syncPersonalRecords(
  supabase: Client,
  input: SaveWorkoutInput,
  workoutLogId: string
): Promise<void> {
  try {
    const candidates = input.exercises
      .filter((ex) => ex.exerciseLibraryId && ex.sets.length > 0)
      .map((ex) => ({
        exerciseId: ex.exerciseLibraryId as string,
        maxWeight: Math.max(...ex.sets.map((s) => s.weightKg ?? 0)),
      }))
      .filter((c) => c.maxWeight > 0);

    if (candidates.length === 0) return;

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
