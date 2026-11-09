import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Reproduce, con las migraciones reales y RLS activa, los pasos con los que la
// app guarda un entrenamiento (apps/mobile/src/hooks/useWorkout.ts): PostgREST
// no admite inserciones anidadas, así que se guarda en pasos planos y el estado
// del log hace de marca de commit.

const id = (number: number) => '00000000-0000-0000-0000-' + String(number).padStart(12, '0');
const migration = (name: string) =>
  readFileSync(new URL('../migrations/' + name, import.meta.url), 'utf8');

const ME = id(1);
const OTHER = id(2);
const ORG = id(100);
const LIB_SQUAT = id(500);

let db: PGlite;

async function asUser<T>(userId: string, sql: string, params: unknown[] = []) {
  await db.exec('SET ROLE authenticated');
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId]);
    return await db.query<T>(sql, params);
  } finally {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");
  }
}

/** Los mismos tres inserts planos que hace la app, como el usuario indicado. */
async function saveFlat(userId: string) {
  const log = await asUser<{ id: string }>(
    userId,
    `INSERT INTO public.workout_logs (organization_id, profile_id, status, started_at)
     VALUES ($1, $2, 'in_progress', now()) RETURNING id`,
    [ORG, userId]
  );
  const logId = log.rows[0].id;
  const exercise = await asUser<{ id: string; order_index: number }>(
    userId,
    `INSERT INTO public.workout_exercises (workout_log_id, exercise_library_id, order_index)
     VALUES ($1, $2, 0) RETURNING id, order_index`,
    [logId, LIB_SQUAT]
  );
  await asUser(
    userId,
    `INSERT INTO public.exercise_sets (workout_exercise_id, set_number, reps, weight_kg, completed)
     VALUES ($1, 1, 5, 100, true), ($1, 2, 5, 110, true)`,
    [exercise.rows[0].id]
  );
  return { logId, exerciseId: exercise.rows[0].id };
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
      deleted_at timestamptz
    );
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
  `);
  for (const name of [
    '000001_create_schema.sql',
    '000002_create_functions.sql',
    '000003_create_rls_policies.sql',
    '000009_workout_delete.sql',
  ])
    await db.exec(migration(name));

  for (const user of [ME, OTHER]) {
    await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [user, user + '@t.local']);
  }
  await db.query("INSERT INTO public.organizations (id, name, slug) VALUES ($1, 'Gym', 'gym')", [
    ORG,
  ]);
  for (const [membership, user] of [
    [201, ME],
    [202, OTHER],
  ] as const) {
    await db.query(
      "INSERT INTO public.memberships (id, organization_id, profile_id, role) VALUES ($1, $2, $3, 'member')",
      [id(membership), ORG, user]
    );
  }
  await db.query(
    "INSERT INTO public.exercise_library (id, organization_id, name, category, primary_muscle) VALUES ($1, $2, 'Sentadilla', 'strength', 'quadriceps')",
    [LIB_SQUAT, ORG]
  );
  await db.exec(
    'GRANT USAGE ON SCHEMA public TO authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;'
  );
}, 60000);

afterAll(async () => {
  if (db) await db.close();
});

describe('saving a workout in flat steps under RLS', () => {
  it('lets the owner insert log, exercises and sets, then mark it completed', async () => {
    const { logId } = await saveFlat(ME);

    const done = await asUser<{ id: string }>(
      ME,
      `UPDATE public.workout_logs SET status = 'completed', completed_at = now()
       WHERE id = $1 RETURNING id`,
      [logId]
    );
    expect(done.rows).toHaveLength(1);

    const history = await asUser<{ id: string; sets: number }>(
      ME,
      `SELECT l.id, (SELECT count(*)::int FROM public.exercise_sets s
                     JOIN public.workout_exercises e ON e.id = s.workout_exercise_id
                     WHERE e.workout_log_id = l.id) AS sets
       FROM public.workout_logs l WHERE l.profile_id = $1 AND l.status = 'completed'`,
      [ME]
    );
    expect(history.rows).toEqual([{ id: logId, sets: 2 }]);
  });

  it('keeps an unfinished log out of the history (status is the commit marker)', async () => {
    const { logId } = await saveFlat(ME);

    const completed = await asUser<{ id: string }>(
      ME,
      "SELECT id FROM public.workout_logs WHERE profile_id = $1 AND status = 'completed' AND id = $2",
      [ME, logId]
    );
    expect(completed.rows).toHaveLength(0);
  });

  it('lets the owner cancel a half-saved log', async () => {
    const { logId } = await saveFlat(ME);

    const cancelled = await asUser(
      ME,
      "UPDATE public.workout_logs SET status = 'cancelled' WHERE id = $1 RETURNING id",
      [logId]
    );
    expect(cancelled.rows).toHaveLength(1);
  });

  it('lets the owner delete a workout, taking its exercises and sets along', async () => {
    const { logId, exerciseId } = await saveFlat(ME);

    const deleted = await asUser(ME, 'DELETE FROM public.workout_logs WHERE id = $1 RETURNING id', [
      logId,
    ]);
    expect(deleted.rows).toHaveLength(1);
    const exercises = await db.query('SELECT 1 FROM public.workout_exercises WHERE id = $1', [
      exerciseId,
    ]);
    expect(exercises.rows).toHaveLength(0);
    const sets = await db.query(
      'SELECT 1 FROM public.exercise_sets WHERE workout_exercise_id = $1',
      [exerciseId]
    );
    expect(sets.rows).toHaveLength(0);
  });

  it("does not let someone else delete another member's workout", async () => {
    const { logId } = await saveFlat(ME);

    const deleted = await asUser(
      OTHER,
      'DELETE FROM public.workout_logs WHERE id = $1 RETURNING id',
      [logId]
    );
    expect(deleted.rows).toHaveLength(0);
    const stillThere = await db.query('SELECT 1 FROM public.workout_logs WHERE id = $1', [logId]);
    expect(stillThere.rows).toHaveLength(1);
  });

  it("does not let someone else read another member's workout", async () => {
    const { logId } = await saveFlat(ME);

    const seen = await asUser(OTHER, 'SELECT id FROM public.workout_logs WHERE id = $1', [logId]);
    expect(seen.rows).toHaveLength(0);
  });

  it("does not let someone else add sets to another member's exercise", async () => {
    const { exerciseId } = await saveFlat(ME);

    await expect(
      asUser(
        OTHER,
        `INSERT INTO public.exercise_sets (workout_exercise_id, set_number, reps, completed)
         VALUES ($1, 99, 1, true)`,
        [exerciseId]
      )
    ).rejects.toThrow();
  });

  it('rejects the old nested payload: workout_logs has no workout_exercises column', async () => {
    // Lo que mandaba la app antes: la relación anidada como si fuera una columna.
    await expect(
      asUser(
        ME,
        `INSERT INTO public.workout_logs (organization_id, profile_id, workout_exercises)
         VALUES ($1, $2, '[]')`,
        [ORG, ME]
      )
    ).rejects.toThrow(/workout_exercises/);
  });
});
