-- NexoFit: let members delete their own registered workouts.
-- Apply after 000001 through 000008. Safe to re-run.
--
-- workout_logs only had select/insert/update policies, so a member could not
-- delete a workout. Exercises and sets go away with it (ON DELETE CASCADE) and
-- personal records keep their value (workout_log_id is set to NULL).
--
-- Until this runs, the app falls back to marking the workout `cancelled`,
-- which hides it from the history.

BEGIN;

DROP POLICY IF EXISTS "workout_logs_delete" ON public.workout_logs;
CREATE POLICY "workout_logs_delete" ON public.workout_logs
  FOR DELETE USING (profile_id = auth.uid());

COMMIT;

NOTIFY pgrst, 'reload schema';
