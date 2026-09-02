-- Migration 000002: Row-Level Security policies for all tables
-- Every table is scoped by organization_id via memberships

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select" ON public.organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM public.memberships WHERE profile_id = auth.uid())
  );

CREATE POLICY "org_insert" ON public.organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

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

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profile_select_org" ON public.profiles
  FOR SELECT USING (
    id IN (
      SELECT m.profile_id FROM public.memberships m
      WHERE m.organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
      )
    )
  );

CREATE POLICY "profile_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "profile_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ============================================================
-- MEMBERSHIPS
-- ============================================================

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membership_select" ON public.memberships
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "membership_insert" ON public.memberships
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "membership_update" ON public.memberships
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "membership_delete" ON public.memberships
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- CLASS TYPES
-- ============================================================

ALTER TABLE public.class_types ENABLE ROW LEVEL SECURITY;

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
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- COACHES
-- ============================================================

ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.waitlist_positions ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.workout_programs ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "measurement_select_own" ON public.measurements
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "measurement_select_org" ON public.measurements
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

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

CREATE POLICY "measurement_insert" ON public.measurements
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role IN ('admin', 'coach', 'professional')
    )
  );

-- ============================================================
-- MEASUREMENT VALUES
-- ============================================================

ALTER TABLE public.measurement_values ENABLE ROW LEVEL SECURITY;

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

-- ============================================================
-- ACCESS PERMISSIONS
-- ============================================================

ALTER TABLE public.access_permissions ENABLE ROW LEVEL SECURITY;

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
  FOR SELECT USING (
    measurement_id IN (
      SELECT m.id FROM public.measurements m WHERE m.profile_id = auth.uid()
    )
  );

CREATE POLICY "access_insert" ON public.access_permissions
  FOR INSERT WITH CHECK (
    measurement_id IN (
      SELECT m.id FROM public.measurements m WHERE m.profile_id = auth.uid()
    )
  );

CREATE POLICY "access_delete" ON public.access_permissions
  FOR DELETE USING (
    measurement_id IN (
      SELECT m.id FROM public.measurements m WHERE m.profile_id = auth.uid()
    )
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

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
