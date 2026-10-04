-- NexoFit · 000001 · Schema: enums, tables, indexes, triggers
--
-- Consolidated final schema (supersedes the old 000001/000004/000005 files).
-- Idempotent: safe to re-run on an existing project.
--
-- Run order: 000001_create_schema.sql
--            -> 000002_create_functions.sql
--            -> 000003_create_rls_policies.sql   (Supabase SQL Editor)

-- ============================================================
-- ENUMS
-- ============================================================
-- CREATE TYPE has no IF NOT EXISTS, so each creation is wrapped in a
-- DO block that swallows "type already exists".

DO $$
BEGIN
  BEGIN
    CREATE TYPE public.role_type AS ENUM ('admin', 'coach', 'professional', 'member');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE TYPE public.booking_status AS ENUM ('confirmed', 'cancelled', 'attended', 'no_show');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE TYPE public.measurement_source AS ENUM ('manual', 'inbody', 'other');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE TYPE public.exercise_category AS ENUM (
      'strength', 'cardio', 'mobility', 'gymnastics', 'olympic', 'strongman', 'other'
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE TYPE public.muscle_group AS ENUM (
      'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
      'abs', 'obliques', 'lower_back', 'glutes', 'quadriceps', 'hamstrings',
      'calves', 'adductors', 'abductors', 'full_body'
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE TYPE public.workout_status AS ENUM ('in_progress', 'completed', 'cancelled');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE TYPE public.set_type AS ENUM (
      'normal', 'warmup', 'dropset', 'failure', 'amrap', 'emom', 'tabata'
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============================================================
-- ORGANIZATIONS / VENUES / SPACES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name text NOT NULL,
  capacity int NOT NULL CHECK (capacity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PROFILES / ROLES / MEMBERSHIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.role_type NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, profile_id)
);

-- ============================================================
-- CLASS TYPES / SESSIONS / COACHES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.class_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#0B9B91',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  specialization text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_type_id uuid NOT NULL REFERENCES public.class_types(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES public.coaches(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity_override int CHECK (capacity_override IS NULL OR capacity_override > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

-- ============================================================
-- BOOKINGS / WAITLIST / ATTENDANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.booking_status NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  UNIQUE (session_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.waitlist_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  checked_in_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- WORKOUT PROGRAMS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workout_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  content text NOT NULL,
  published_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PROFESSIONALS / SERVICES / APPOINTMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  specialization text NOT NULL,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_minutes int NOT NULL CHECK (duration_minutes > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CHECK (ends_at > starts_at)
);

-- ============================================================
-- MEASUREMENTS / ACCESS PERMISSIONS
-- ============================================================

-- organization_id is nullable on purpose: a member can log body measurements
-- without belonging to a gym (logged as organization_id IS NULL).
CREATE TABLE IF NOT EXISTS public.measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  measured_at timestamptz NOT NULL,
  source public.measurement_source NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.measurement_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL REFERENCES public.measurements(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  value_numeric numeric NOT NULL,
  unit text
);

CREATE TABLE IF NOT EXISTS public.access_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL REFERENCES public.measurements(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (measurement_id, professional_id)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- WORKOUT TRACKING (Stage 4): library, logs, sets, PRs, templates
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exercise_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category public.exercise_category NOT NULL DEFAULT 'strength',
  primary_muscle public.muscle_group,
  secondary_muscles public.muscle_group[],
  equipment text[],
  instructions text,
  video_url text,
  image_url text,
  is_custom boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  workout_program_id uuid REFERENCES public.workout_programs(id) ON DELETE SET NULL,
  status public.workout_status NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_seconds int,
  notes text,
  rpe_overall int CHECK (rpe_overall BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_log_id uuid NOT NULL REFERENCES public.workout_logs(id) ON DELETE CASCADE,
  exercise_library_id uuid REFERENCES public.exercise_library(id) ON DELETE SET NULL,
  custom_name text, -- Exercises not in the library
  order_index int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exercise_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id uuid NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
  set_number int NOT NULL,
  type public.set_type NOT NULL DEFAULT 'normal',
  reps int,
  weight_kg numeric(6,2), -- Supports fractional kg
  distance_meters numeric(8,2),
  duration_seconds int,
  rpe int CHECK (rpe BETWEEN 1 AND 10),
  rest_seconds int DEFAULT 90,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_library_id uuid NOT NULL REFERENCES public.exercise_library(id) ON DELETE CASCADE,
  record_type text NOT NULL, -- '1rm', 'max_reps', 'max_weight', 'max_distance', 'best_time'
  value_numeric numeric NOT NULL,
  unit text NOT NULL, -- 'kg', 'reps', 'm', 's'
  reps int,
  weight_kg numeric(6,2),
  achieved_at timestamptz NOT NULL DEFAULT now(),
  workout_log_id uuid REFERENCES public.workout_logs(id) ON DELETE SET NULL,
  notes text,
  UNIQUE (profile_id, exercise_library_id, record_type)
);

CREATE TABLE IF NOT EXISTS public.workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  estimated_duration_minutes int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workout_template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  exercise_library_id uuid NOT NULL REFERENCES public.exercise_library(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  target_sets int,
  target_reps text, -- e.g. "8-12", "5x5", "AMRAP"
  target_weight_kg numeric(6,2),
  target_rpe int,
  rest_seconds int DEFAULT 90,
  notes text
);

-- Older setups created this column as NOT NULL (000007 made it optional).
ALTER TABLE public.measurements ALTER COLUMN organization_id DROP NOT NULL;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sessions_starts_at ON public.sessions(starts_at);
CREATE INDEX IF NOT EXISTS idx_sessions_class_type ON public.sessions(class_type_id);
CREATE INDEX IF NOT EXISTS idx_bookings_session ON public.bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_profile ON public.bookings(profile_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_session ON public.waitlist_positions(session_id);
CREATE INDEX IF NOT EXISTS idx_appointments_professional ON public.appointments(professional_id);
CREATE INDEX IF NOT EXISTS idx_appointments_profile ON public.appointments(profile_id);
CREATE INDEX IF NOT EXISTS idx_measurements_profile ON public.measurements(profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_profile ON public.notifications(profile_id);

CREATE INDEX IF NOT EXISTS idx_exercise_library_org ON public.exercise_library(organization_id);
CREATE INDEX IF NOT EXISTS idx_exercise_library_category ON public.exercise_library(category);
CREATE INDEX IF NOT EXISTS idx_workout_logs_profile ON public.workout_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_session ON public.workout_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_status ON public.workout_logs(status);
CREATE INDEX IF NOT EXISTS idx_workout_logs_started ON public.workout_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_log ON public.workout_exercises(workout_log_id);
CREATE INDEX IF NOT EXISTS idx_exercise_sets_exercise ON public.exercise_sets(workout_exercise_id);
CREATE INDEX IF NOT EXISTS idx_personal_records_profile ON public.personal_records(profile_id);
CREATE INDEX IF NOT EXISTS idx_personal_records_exercise ON public.personal_records(exercise_library_id);
CREATE INDEX IF NOT EXISTS idx_workout_templates_org ON public.workout_templates(organization_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create a profile row when a user signs up (auth.users insert).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name')
  );
  RETURN NEW;
END;
$$;

-- Single shared trigger for every updated_at column.
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE TRIGGER workout_programs_updated_at
  BEFORE UPDATE ON public.workout_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE TRIGGER workout_logs_updated_at
  BEFORE UPDATE ON public.workout_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE TRIGGER exercise_sets_updated_at
  BEFORE UPDATE ON public.exercise_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Cleanup: older setups created one function per table; the triggers above
-- (re)pointed to update_updated_at(), so nothing depends on them anymore.
DROP FUNCTION IF EXISTS public.update_workout_log_updated_at();
DROP FUNCTION IF EXISTS public.update_exercise_set_updated_at();
