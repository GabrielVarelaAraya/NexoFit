import { describe, expect, it } from 'vitest';
import { copyExercisesFromLog } from './workoutCopy';
import type { WorkoutLogItem } from '../types/screens';

const log: WorkoutLogItem = {
  id: 'l1',
  started_at: '2026-11-01T12:00:00Z',
  completed_at: '2026-11-01T12:30:00Z',
  status: 'completed',
  notes: 'Buen día',
  session_id: null,
  workout_exercises: [
    {
      id: 'e2',
      order_index: 1,
      custom_name: 'Remo casero',
      exercise_library_id: null,
      exercise_library: null,
      exercise_sets: [{ id: 's3', set_number: 1, reps: 12, weight_kg: null, completed: true }],
    },
    {
      id: 'e1',
      order_index: 0,
      custom_name: null,
      exercise_library_id: 'lib-1',
      exercise_library: { name: 'Press banca' },
      exercise_sets: [
        { id: 's2', set_number: 2, reps: 8, weight_kg: 62.5, completed: true },
        { id: 's1', set_number: 1, reps: 10, weight_kg: 60, completed: true },
      ],
    },
    {
      id: 'e3',
      order_index: 2,
      custom_name: 'Vacío',
      exercise_library_id: null,
      exercise_library: null,
      exercise_sets: [],
    },
  ],
};

describe('copyExercisesFromLog', () => {
  it('keeps order, names, reps and weights, and drops notes/date', () => {
    expect(copyExercisesFromLog(log)).toEqual([
      {
        libraryId: 'lib-1',
        name: 'Press banca',
        sets: [
          { reps: '10', weight: '60' },
          { reps: '8', weight: '62.5' },
        ],
      },
      { libraryId: null, name: 'Remo casero', sets: [{ reps: '12', weight: '' }] },
    ]);
  });
});
