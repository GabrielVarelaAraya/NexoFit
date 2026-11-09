import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildExerciseRows,
  buildSetRows,
  deleteWorkoutWithClient,
  saveWorkoutWithClient,
  type SaveWorkoutInput,
} from './useWorkout';

interface Call {
  table: string;
  op: 'insert' | 'update' | 'select';
  values?: unknown;
  filters: [string, unknown][];
}

type Failure = { table: string; op: 'insert' | 'update' };

/** Cliente de Supabase mínimo: registra cada llamada y permite forzar un fallo. */
function fakeClient(fail?: Failure) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, op: 'select', filters: [] };
      const run = (single: boolean) => {
        calls.push(call);
        if (fail && fail.table === table && fail.op === call.op) {
          return { data: null, error: { message: `boom ${table}` } };
        }
        if (call.op === 'insert' && table === 'workout_logs') {
          return { data: single ? { id: 'log-1' } : [{ id: 'log-1' }], error: null };
        }
        if (call.op === 'insert' && table === 'workout_exercises') {
          // Devueltos en orden inverso a propósito: el mapeo debe ser por order_index.
          const rows = (call.values as { order_index: number }[]).map((row) => ({
            id: `ex-${row.order_index}`,
            order_index: row.order_index,
          }));
          return { data: rows.reverse(), error: null };
        }
        return { data: [], error: null };
      };
      const builder = {
        insert(values: unknown) {
          call.op = 'insert';
          call.values = values;
          return builder;
        },
        update(values: unknown) {
          call.op = 'update';
          call.values = values;
          return builder;
        },
        select() {
          return builder;
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          return builder;
        },
        in() {
          return builder;
        },
        single: () => Promise.resolve(run(true)),
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(run(false)).then(resolve, reject),
      };
      return builder;
    },
  };
  return { client: client as never, calls };
}

const input: SaveWorkoutInput = {
  organizationId: 'org-1',
  profileId: 'me',
  startedAt: '2026-11-08T10:00:00Z',
  notes: '  buen día  ',
  exercises: [
    {
      exerciseLibraryId: 'lib-squat',
      customName: null,
      sets: [
        { reps: 5, weightKg: 100 },
        { reps: 5, weightKg: 110 },
      ],
    },
    { exerciseLibraryId: null, customName: 'Burpees', sets: [{ reps: 20, weightKg: null }] },
  ],
};

const summary = (calls: Call[]) => calls.map((c) => `${c.op}:${c.table}`);

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildExerciseRows / buildSetRows', () => {
  it('builds flat rows with order and custom names', () => {
    expect(buildExerciseRows('log-1', input.exercises)).toEqual([
      {
        workout_log_id: 'log-1',
        exercise_library_id: 'lib-squat',
        custom_name: null,
        order_index: 0,
      },
      {
        workout_log_id: 'log-1',
        exercise_library_id: null,
        custom_name: 'Burpees',
        order_index: 1,
      },
    ]);
  });

  it('numbers the sets and skips exercises whose id is unknown', () => {
    const rows = buildSetRows(new Map([[0, 'ex-0']]), input.exercises);
    expect(rows.map((r) => [r.workout_exercise_id, r.set_number])).toEqual([
      ['ex-0', 1],
      ['ex-0', 2],
    ]);
  });
});

describe('saveWorkoutWithClient', () => {
  it('saves in flat steps and only then marks the log as completed', async () => {
    const { client, calls } = fakeClient();

    const result = await saveWorkoutWithClient(client, input);

    expect(result.success).toBe(true);
    expect(summary(calls).slice(0, 4)).toEqual([
      'insert:workout_logs',
      'insert:workout_exercises',
      'insert:exercise_sets',
      'update:workout_logs',
    ]);
    // El log nace in_progress y se completa al final.
    expect(calls[0].values).toMatchObject({ status: 'in_progress', notes: 'buen día' });
    expect(calls[3].values).toMatchObject({ status: 'completed' });
    expect(calls[3].filters).toEqual([['id', 'log-1']]);
  });

  it('never sends nested relations to PostgREST (the original bug)', async () => {
    const { client, calls } = fakeClient();
    await saveWorkoutWithClient(client, input);

    const logInsert = calls[0].values as Record<string, unknown>;
    expect(logInsert).not.toHaveProperty('workout_exercises');
    for (const row of calls[1].values as Record<string, unknown>[]) {
      expect(row).not.toHaveProperty('exercise_sets');
    }
  });

  it('attaches each set to its exercise by order_index, not by response order', async () => {
    const { client, calls } = fakeClient();
    await saveWorkoutWithClient(client, input);

    const sets = calls[2].values as { workout_exercise_id: string; set_number: number }[];
    expect(sets.map((s) => `${s.workout_exercise_id}#${s.set_number}`)).toEqual([
      'ex-0#1',
      'ex-0#2',
      'ex-1#1',
    ]);
  });

  it('records a personal best after saving', async () => {
    const { client, calls } = fakeClient();
    await saveWorkoutWithClient(client, input);

    const record = calls.find((c) => c.op === 'insert' && c.table === 'personal_records');
    expect(record?.values).toMatchObject([
      { exercise_library_id: 'lib-squat', value_numeric: 110, workout_log_id: 'log-1' },
    ]);
  });

  it('cancels the log and reports failure if the exercises cannot be saved', async () => {
    const { client, calls } = fakeClient({ table: 'workout_exercises', op: 'insert' });

    const result = await saveWorkoutWithClient(client, input);

    expect(result.success).toBe(false);
    expect(summary(calls)).toEqual([
      'insert:workout_logs',
      'insert:workout_exercises',
      'update:workout_logs',
    ]);
    expect(calls[2].values).toEqual({ status: 'cancelled' });
  });

  it('cancels the log if the sets cannot be saved, and never completes it', async () => {
    const { client, calls } = fakeClient({ table: 'exercise_sets', op: 'insert' });

    const result = await saveWorkoutWithClient(client, input);

    expect(result.success).toBe(false);
    const updates = calls.filter((c) => c.op === 'update').map((c) => c.values);
    expect(updates).toEqual([{ status: 'cancelled' }]);
  });

  it('does nothing else when the log itself cannot be created', async () => {
    const { client, calls } = fakeClient({ table: 'workout_logs', op: 'insert' });

    const result = await saveWorkoutWithClient(client, input);

    expect(result.success).toBe(false);
    expect(summary(calls)).toEqual(['insert:workout_logs']);
  });

  it('saves a workout with no exercises without extra inserts', async () => {
    const { client, calls } = fakeClient();

    const result = await saveWorkoutWithClient(client, { ...input, exercises: [] });

    expect(result.success).toBe(true);
    expect(summary(calls)).toEqual(['insert:workout_logs', 'update:workout_logs']);
  });
});

describe('deleteWorkoutWithClient', () => {
  /** Responde a delete() y update() con lo que se indique, y anota el orden. */
  function deleteClient(results: { delete: unknown; update?: unknown }) {
    const ops: string[] = [];
    const client = {
      from() {
        let op = '';
        const builder = {
          delete() {
            op = 'delete';
            return builder;
          },
          update() {
            op = 'update';
            return builder;
          },
          eq() {
            return builder;
          },
          select() {
            ops.push(op);
            return Promise.resolve(op === 'delete' ? results.delete : results.update);
          },
        };
        return builder;
      },
    };
    return { client: client as never, ops };
  }

  it('deletes the workout when the database allows it', async () => {
    const { client, ops } = deleteClient({ delete: { data: [{ id: 'l1' }], error: null } });
    expect(await deleteWorkoutWithClient(client, 'l1')).toEqual({ success: true });
    expect(ops).toEqual(['delete']);
  });

  it('hides it as cancelled when DELETE removes nothing (policy not applied yet)', async () => {
    const { client, ops } = deleteClient({
      delete: { data: [], error: null },
      update: { data: [{ id: 'l1' }], error: null },
    });
    expect(await deleteWorkoutWithClient(client, 'l1')).toEqual({ success: true });
    expect(ops).toEqual(['delete', 'update']);
  });

  it('reports failure when neither delete nor hide works', async () => {
    const { client } = deleteClient({
      delete: { data: null, error: { message: 'nope' } },
      update: { data: [], error: null },
    });
    expect(await deleteWorkoutWithClient(client, 'l1')).toEqual({ success: false });
  });
});
