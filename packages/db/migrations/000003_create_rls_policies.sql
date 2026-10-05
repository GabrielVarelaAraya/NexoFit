-- NexoFit · 000003 · Row-Level Security: enable + final policies
--
-- Consolidated final policy set (supersedes the old 000002/000005/000007/
-- 000008/000009 files). Idempotent: safe to re-run — it drops every policy
-- in the public schema first and recreates exactly this final state.
-- Requires 000001 + 000002.
--
-- Design rules:
--   * Every table is scoped by organization via memberships.
--   * A policy NEVER queries its own table (that caused infinite recursion,
--     error 42P17): membership/measurement checks go through the
--     SECURITY DEFINER helpers from 000002.
--   * organizations is a public directory for signed-in users; organizations
--     are created ONLY through the create_organization() RPC.

-- ============================================================
-- Enable RLS on every table (no policies = deny by default)
-- ============================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_template_exercises ENABLE ROW LEVEL SECURITY;

-- Drop every existing policy in public so re-running this file always
-- reproduces the final state below (no stale/duplicate policies).
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

-- Directory: any signed-in user can browse gyms (needed to join one).
CREATE POLICY "org_select" ON public.organizations
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Organizations are created only via create_organization() RPC.
CREATE POLICY "org_insert" ON public.organizations
  FOR INSERT WITH CHECK (false);

CREATE POLICY "org_update" ON public.organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "org_delete" ON public.organizations
  FOR DELETE USING (
    id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- VENUES
-- ============================================================

CREATE POLICY "venue_select" ON public.venues
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "venue_insert" ON public.venues
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "venue_update" ON public.venues
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "venue_delete" ON public.venues
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- SPACES
-- ============================================================

CREATE POLICY "space_select" ON public.spaces
  FOR SELECT USING (
    venue_id IN (
      SELECT v.id FROM public.venues v
      WHERE v.organization_id IN (
        SELECT organization_id FROM public.memberships WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "space_insert" ON public.spaces
  FOR INSERT WITH CHECK (
    venue_id IN (
      SELECT v.id FROM public.venues v
      WHERE v.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "space_update" ON public.spaces
  FOR UPDATE USING (
    venue_id IN (
      SELECT v.id FROM public.venues v
      WHERE v.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "space_delete" ON public.spaces
  FOR DELETE USING (
    venue_id IN (
      SELECT v.id FROM public.venues v
      WHERE v.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- ============================================================
-- PROFILES
-- ============================================================

CREATE POLICY "profile_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- A) Admins/coaches see every profile in the orgs they staff.
-- B) Any member sees STAFF profiles (admin/coach/professional) of their orgs,
--    so client screens can render coach and professional names.
CREATE POLICY "profile_select_org" ON public.profiles
  FOR SELECT USING (
    id IN (
      SELECT m.profile_id
      FROM public.memberships m
      WHERE m.organization_id IN (
        SELECT organization_id
        FROM public.memberships
        WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
      )
    )
    OR
    id IN (
      SELECT m.profile_id
      FROM public.memberships m
      WHERE m.role IN ('admin', 'coach', 'professional')
        AND m.organization_id IN (
          SELECT organization_id
          FROM public.memberships
          WHERE profile_id = auth.uid()
        )
    )
  );

CREATE POLICY "profile_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "profile_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ============================================================
-- MEMBERSHIPS
-- (helper predicates — never a self-referencing subquery)
-- ============================================================

CREATE POLICY "membership_select" ON public.memberships
  FOR SELECT USING (public.is_org_member(organization_id));

-- Self-enrollment as 'member' (client decides to join a gym) or an existing
-- admin adding members to their own gym.
CREATE POLICY "membership_insert" ON public.memberships
  FOR INSERT WITH CHECK (
    (profile_id = auth.uid() AND role = 'member')
    OR public.is_org_admin(organization_id)
  );

CREATE POLICY "membership_update" ON public.memberships
  FOR UPDATE USING (public.is_org_admin(organization_id));

CREATE POLICY "membership_delete" ON public.memberships
  FOR DELETE USING (public.is_org_admin(organization_id));

-- ============================================================
-- CLASS TYPES
-- ============================================================

CREATE POLICY "class_type_select" ON public.class_types
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "class_type_insert" ON public.class_types
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

CREATE POLICY "class_type_update" ON public.class_types
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

CREATE POLICY "class_type_delete" ON public.class_types
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

-- ============================================================
-- COACHES
-- ============================================================

CREATE POLICY "coach_select" ON public.coaches
  FOR SELECT USING (
    membership_id IN (
      SELECT m.id FROM public.memberships m
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "coach_insert" ON public.coaches
  FOR INSERT WITH CHECK (
    membership_id IN (
      SELECT m.id FROM public.memberships m
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "coach_update" ON public.coaches
  FOR UPDATE USING (
    membership_id IN (
      SELECT m.id FROM public.memberships m
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "coach_delete" ON public.coaches
  FOR DELETE USING (
    membership_id IN (
      SELECT m.id FROM public.memberships m
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- ============================================================
-- SESSIONS
-- ============================================================

CREATE POLICY "session_select" ON public.sessions
  FOR SELECT USING (
    class_type_id IN (
      SELECT ct.id FROM public.class_types ct
      WHERE ct.organization_id IN (
        SELECT organization_id FROM public.memberships WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "session_insert" ON public.sessions
  FOR INSERT WITH CHECK (
    class_type_id IN (
      SELECT ct.id FROM public.class_types ct
      WHERE ct.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
      )
    )
  );

CREATE POLICY "session_update" ON public.sessions
  FOR UPDATE USING (
    class_type_id IN (
      SELECT ct.id FROM public.class_types ct
      WHERE ct.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
      )
    )
  );

CREATE POLICY "session_delete" ON public.sessions
  FOR DELETE USING (
    class_type_id IN (
      SELECT ct.id FROM public.class_types ct
      WHERE ct.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- ============================================================
-- BOOKINGS
-- ============================================================

CREATE POLICY "booking_select" ON public.bookings
  FOR SELECT USING (
    profile_id = auth.uid()
    OR session_id IN (
      SELECT se.id FROM public.sessions se
      JOIN public.class_types ct ON ct.id = se.class_type_id
      WHERE ct.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
      )
    )
  );

CREATE POLICY "booking_insert" ON public.bookings
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "booking_update" ON public.bookings
  FOR UPDATE USING (
    profile_id = auth.uid()
    OR session_id IN (
      SELECT se.id FROM public.sessions se
      JOIN public.class_types ct ON ct.id = se.class_type_id
      WHERE ct.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
      )
    )
  );

-- ============================================================
-- WAITLIST POSITIONS
-- ============================================================

CREATE POLICY "waitlist_select" ON public.waitlist_positions
  FOR SELECT USING (
    profile_id = auth.uid()
    OR session_id IN (
      SELECT se.id FROM public.sessions se
      JOIN public.class_types ct ON ct.id = se.class_type_id
      WHERE ct.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
      )
    )
  );

CREATE POLICY "waitlist_insert" ON public.waitlist_positions
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "waitlist_delete" ON public.waitlist_positions
  FOR DELETE USING (profile_id = auth.uid());

-- ============================================================
-- ATTENDANCE
-- ============================================================

CREATE POLICY "attendance_select" ON public.attendance
  FOR SELECT USING (
    booking_id IN (
      SELECT b.id FROM public.bookings b
      WHERE b.profile_id = auth.uid()
        OR b.session_id IN (
          SELECT se.id FROM public.sessions se
          JOIN public.class_types ct ON ct.id = se.class_type_id
          WHERE ct.organization_id IN (
            SELECT organization_id FROM public.memberships
            WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
          )
        )
    )
  );

CREATE POLICY "attendance_insert" ON public.attendance
  FOR INSERT WITH CHECK (
    booking_id IN (
      SELECT b.id FROM public.bookings b
      WHERE b.session_id IN (
        SELECT se.id FROM public.sessions se
        JOIN public.class_types ct ON ct.id = se.class_type_id
        WHERE ct.organization_id IN (
          SELECT organization_id FROM public.memberships
          WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
        )
      )
    )
  );

-- ============================================================
-- WORKOUT PROGRAMS
-- ============================================================

CREATE POLICY "program_select" ON public.workout_programs
  FOR SELECT USING (
    session_id IN (
      SELECT se.id FROM public.sessions se
      JOIN public.class_types ct ON ct.id = se.class_type_id
      WHERE ct.organization_id IN (
        SELECT organization_id FROM public.memberships WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "program_insert" ON public.workout_programs
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT se.id FROM public.sessions se
      JOIN public.class_types ct ON ct.id = se.class_type_id
      WHERE ct.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
      )
    )
  );

CREATE POLICY "program_update" ON public.workout_programs
  FOR UPDATE USING (
    session_id IN (
      SELECT se.id FROM public.sessions se
      JOIN public.class_types ct ON ct.id = se.class_type_id
      WHERE ct.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
      )
    )
  );

-- ============================================================
-- PROFESSIONALS
-- ============================================================

CREATE POLICY "professional_select" ON public.professionals
  FOR SELECT USING (
    membership_id IN (
      SELECT m.id FROM public.memberships m
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "professional_insert" ON public.professionals
  FOR INSERT WITH CHECK (
    membership_id IN (
      SELECT m.id FROM public.memberships m
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "professional_update" ON public.professionals
  FOR UPDATE USING (
    membership_id IN (
      SELECT m.id FROM public.memberships m
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "professional_delete" ON public.professionals
  FOR DELETE USING (
    membership_id IN (
      SELECT m.id FROM public.memberships m
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- ============================================================
-- SERVICES
-- ============================================================

CREATE POLICY "service_select" ON public.services
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "service_insert" ON public.services
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "service_update" ON public.services
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "service_delete" ON public.services
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- AVAILABILITY
-- ============================================================

CREATE POLICY "availability_select" ON public.availability
  FOR SELECT USING (
    professional_id IN (
      SELECT p.id FROM public.professionals p
      JOIN public.memberships m ON m.id = p.membership_id
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "availability_insert" ON public.availability
  FOR INSERT WITH CHECK (
    professional_id IN (
      SELECT p.id FROM public.professionals p
      JOIN public.memberships m ON m.id = p.membership_id
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role IN ('admin', 'professional')
      )
    )
  );

CREATE POLICY "availability_update" ON public.availability
  FOR UPDATE USING (
    professional_id IN (
      SELECT p.id FROM public.professionals p
      JOIN public.memberships m ON m.id = p.membership_id
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role IN ('admin', 'professional')
      )
    )
  );

CREATE POLICY "availability_delete" ON public.availability
  FOR DELETE USING (
    professional_id IN (
      SELECT p.id FROM public.professionals p
      JOIN public.memberships m ON m.id = p.membership_id
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role IN ('admin', 'professional')
      )
    )
  );

-- ============================================================
-- APPOINTMENTS
-- ============================================================

CREATE POLICY "appointment_select" ON public.appointments
  FOR SELECT USING (
    profile_id = auth.uid()
    OR professional_id IN (
      SELECT p.id FROM public.professionals p
      JOIN public.memberships m ON m.id = p.membership_id
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role IN ('admin', 'professional')
      )
    )
  );

CREATE POLICY "appointment_insert" ON public.appointments
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "appointment_update" ON public.appointments
  FOR UPDATE USING (
    profile_id = auth.uid()
    OR professional_id IN (
      SELECT p.id FROM public.professionals p
      JOIN public.memberships m ON m.id = p.membership_id
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role IN ('admin', 'professional')
      )
    )
  );

-- ============================================================
-- MEASUREMENTS
-- ============================================================

CREATE POLICY "measurement_select_own" ON public.measurements
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "measurement_select_org" ON public.measurements
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

-- Professionals see measurements they have been granted access to
-- (access_permissions is read through the owns_measurement helper, so the
-- two tables never reference each other in a cycle).
CREATE POLICY "measurement_select_professional" ON public.measurements
  FOR SELECT USING (
    id IN (
      SELECT ap.measurement_id FROM public.access_permissions ap
      WHERE ap.professional_id IN (
        SELECT p.id FROM public.professionals p
        WHERE p.membership_id IN (
          SELECT m.id FROM public.memberships m
          WHERE m.profile_id = auth.uid() AND m.role = 'professional'
        )
      )
    )
  );

-- Staff can log measurements for members of their org.
CREATE POLICY "measurement_insert" ON public.measurements
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role IN ('admin', 'coach', 'professional')
    )
  );

-- A member can log their own measurements: with their gym or with no gym
-- (organization_id IS NULL).
CREATE POLICY "measurement_insert_own" ON public.measurements
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND (
      organization_id IS NULL
      OR public.is_org_member(organization_id)
    )
  );

CREATE POLICY "measurement_delete_own" ON public.measurements
  FOR DELETE USING (profile_id = auth.uid());

-- ============================================================
-- MEASUREMENT VALUES
-- ============================================================

CREATE POLICY "measurement_value_select" ON public.measurement_values
  FOR SELECT USING (
    measurement_id IN (
      SELECT m.id FROM public.measurements m WHERE m.profile_id = auth.uid()
    )
    OR measurement_id IN (
      SELECT m.id FROM public.measurements m
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
      )
    )
    OR measurement_id IN (
      SELECT m.id FROM public.measurements m
      JOIN public.access_permissions ap ON ap.measurement_id = m.id
      WHERE ap.professional_id IN (
        SELECT p.id FROM public.professionals p
        WHERE p.membership_id IN (
          SELECT m2.id FROM public.memberships m2
          WHERE m2.profile_id = auth.uid() AND m2.role = 'professional'
        )
      )
    )
  );

CREATE POLICY "measurement_value_insert" ON public.measurement_values
  FOR INSERT WITH CHECK (
    measurement_id IN (
      SELECT m.id FROM public.measurements m
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role IN ('admin', 'coach', 'professional')
      )
    )
  );

-- Members add values to their own measurements (with or without a gym).
CREATE POLICY "measurement_value_insert_own" ON public.measurement_values
  FOR INSERT WITH CHECK (
    measurement_id IN (
      SELECT m.id FROM public.measurements m
      WHERE m.profile_id = auth.uid()
    )
  );

CREATE POLICY "measurement_value_delete_own" ON public.measurement_values
  FOR DELETE USING (
    measurement_id IN (
      SELECT m.id FROM public.measurements m
      WHERE m.profile_id = auth.uid()
    )
  );

-- ============================================================
-- ACCESS PERMISSIONS
-- ============================================================

CREATE POLICY "access_select_professional" ON public.access_permissions
  FOR SELECT USING (
    professional_id IN (
      SELECT p.id FROM public.professionals p
      WHERE p.membership_id IN (
        SELECT m.id FROM public.memberships m
        WHERE m.profile_id = auth.uid() AND m.role = 'professional'
      )
    )
  );

CREATE POLICY "access_select_member" ON public.access_permissions
  FOR SELECT USING (public.owns_measurement(measurement_id));

CREATE POLICY "access_insert" ON public.access_permissions
  FOR INSERT WITH CHECK (public.owns_measurement(measurement_id));

CREATE POLICY "access_delete" ON public.access_permissions
  FOR DELETE USING (public.owns_measurement(measurement_id));

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE POLICY "notification_select" ON public.notifications
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "notification_insert" ON public.notifications
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

CREATE POLICY "notification_update" ON public.notifications
  FOR UPDATE USING (profile_id = auth.uid());

-- ============================================================
-- EXERCISE LIBRARY (org members view, staff manages)
-- ============================================================

CREATE POLICY "exercise_library_select" ON public.exercise_library
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "exercise_library_insert" ON public.exercise_library
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

CREATE POLICY "exercise_library_update" ON public.exercise_library
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

CREATE POLICY "exercise_library_delete" ON public.exercise_library
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- WORKOUT LOGS (own logs; staff sees everyone in the org)
-- ============================================================

CREATE POLICY "workout_logs_select" ON public.workout_logs
  FOR SELECT USING (
    profile_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

CREATE POLICY "workout_logs_insert" ON public.workout_logs
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "workout_logs_update" ON public.workout_logs
  FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY "workout_exercises_select" ON public.workout_exercises
  FOR SELECT USING (
    workout_log_id IN (
      SELECT id FROM public.workout_logs
      WHERE profile_id = auth.uid()
        OR organization_id IN (
          SELECT organization_id FROM public.memberships
          WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
        )
    )
  );

CREATE POLICY "workout_exercises_insert" ON public.workout_exercises
  FOR INSERT WITH CHECK (
    workout_log_id IN (
      SELECT id FROM public.workout_logs WHERE profile_id = auth.uid()
    )
  );

-- ============================================================
-- EXERCISE SETS
-- ============================================================

CREATE POLICY "exercise_sets_select" ON public.exercise_sets
  FOR SELECT USING (
    workout_exercise_id IN (
      SELECT we.id FROM public.workout_exercises we
      JOIN public.workout_logs wl ON wl.id = we.workout_log_id
      WHERE wl.profile_id = auth.uid()
        OR wl.organization_id IN (
          SELECT organization_id FROM public.memberships
          WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
        )
    )
  );

CREATE POLICY "exercise_sets_insert" ON public.exercise_sets
  FOR INSERT WITH CHECK (
    workout_exercise_id IN (
      SELECT we.id FROM public.workout_exercises we
      JOIN public.workout_logs wl ON wl.id = we.workout_log_id
      WHERE wl.profile_id = auth.uid()
    )
  );

CREATE POLICY "exercise_sets_update" ON public.exercise_sets
  FOR UPDATE USING (
    workout_exercise_id IN (
      SELECT we.id FROM public.workout_exercises we
      JOIN public.workout_logs wl ON wl.id = we.workout_log_id
      WHERE wl.profile_id = auth.uid()
    )
  );

-- ============================================================
-- PERSONAL RECORDS
-- ============================================================

CREATE POLICY "personal_records_select" ON public.personal_records
  FOR SELECT USING (
    profile_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

CREATE POLICY "personal_records_insert" ON public.personal_records
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- ============================================================
-- WORKOUT TEMPLATES
-- ============================================================

CREATE POLICY "workout_templates_select" ON public.workout_templates
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships WHERE profile_id = auth.uid()
    )
    OR is_public = true
  );

CREATE POLICY "workout_templates_insert" ON public.workout_templates
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

CREATE POLICY "workout_templates_update" ON public.workout_templates
  FOR UPDATE USING (
    created_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "workout_template_exercises_select" ON public.workout_template_exercises
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM public.workout_templates
      WHERE organization_id IN (
        SELECT organization_id FROM public.memberships WHERE profile_id = auth.uid()
      )
      OR is_public = true
    )
  );

CREATE POLICY "workout_template_exercises_insert" ON public.workout_template_exercises
  FOR INSERT WITH CHECK (
    template_id IN (
      SELECT id FROM public.workout_templates
      WHERE created_by = auth.uid()
        OR organization_id IN (
          SELECT organization_id FROM public.memberships
          WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
        )
    )
  );

-- ============================================================
-- MEMBERSHIP PLANS & PAYMENTS (Stage 5)
-- ============================================================

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Los planes (precios) los ve cualquier miembro del org; solo el admin los gestiona.
CREATE POLICY "membership_plans_select" ON public.membership_plans
  FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY "membership_plans_insert" ON public.membership_plans
  FOR INSERT WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "membership_plans_update" ON public.membership_plans
  FOR UPDATE USING (public.is_org_admin(organization_id));

CREATE POLICY "membership_plans_delete" ON public.membership_plans
  FOR DELETE USING (public.is_org_admin(organization_id));

-- Cada quien ve sus pagos; el admin del org ve los del gimnasio entero.
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT USING (
    profile_id = auth.uid()
    OR public.is_org_admin(organization_id)
  );

CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "payments_update" ON public.payments
  FOR UPDATE USING (public.is_org_admin(organization_id));

-- Sin política de DELETE a propósito: el libro de pagos no se borra,
-- los cambios se registran como status 'refunded'.
