-- NexoFit: member appointment booking and service ownership.
-- Apply after 000001 through 000006. Re-run this file after re-running
-- 000003 (it recreates the service policies that 000003 replaces).
--
-- Gym-local wall-clock time is America/Costa_Rica: availability day_of_week
-- and clock times are entered as local gym time, and candidates are built in
-- the member's device-local time. Update here if the product expands to
-- other time zones.
--
-- SECURITY DEFINER lets the function validate the slot (availability,
-- conflicts, ownership) without recursing into the very policies it
-- complements, and serializes concurrent bookings with a row lock.

BEGIN;

-- ============================================================
-- Service ownership: the owning professional manages their own
-- services (000003 restricted writes to org admins only).
-- ============================================================

DROP POLICY IF EXISTS service_insert ON public.services;
CREATE POLICY service_insert ON public.services
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.professionals p
      JOIN public.memberships m ON m.id = p.membership_id
      WHERE p.id = public.services.professional_id
        AND m.profile_id = auth.uid()
        AND m.organization_id = public.services.organization_id
    )
  );

DROP POLICY IF EXISTS service_update ON public.services;
CREATE POLICY service_update ON public.services
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.professionals p
      JOIN public.memberships m ON m.id = p.membership_id
      WHERE p.id = public.services.professional_id
        AND m.profile_id = auth.uid()
        AND m.organization_id = public.services.organization_id
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.professionals p
      JOIN public.memberships m ON m.id = p.membership_id
      WHERE p.id = public.services.professional_id
        AND m.profile_id = auth.uid()
        AND m.organization_id = public.services.organization_id
    )
  );

DROP POLICY IF EXISTS service_delete ON public.services;
CREATE POLICY service_delete ON public.services
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.professionals p
      JOIN public.memberships m ON m.id = p.membership_id
      WHERE p.id = public.services.professional_id
        AND m.profile_id = auth.uid()
        AND m.organization_id = public.services.organization_id
    )
  );

-- ============================================================
-- Protect appointment history: a service with registered appointments
-- cannot be deleted (was ON DELETE CASCADE in 000001, which silently
-- wiped the appointment rows that reference it).
-- ============================================================

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_service_id_fkey;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;

-- ============================================================
-- book_appointment: member booking of a 1-on-1 slot.
--
-- Locks the professional row first, which serializes concurrent bookings
-- of the same professional so the availability and conflict checks cannot
-- race. Returns json: {status: confirmed | member_conflict | slot_taken |
-- error, message, appointment_id?}.
-- ============================================================

CREATE OR REPLACE FUNCTION public.book_appointment(
  p_professional_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := auth.uid();
  v_organization_id uuid;
  v_duration int;
  v_ends_at timestamptz;
  v_day int;
  v_start_minutes int;
  v_block_start int;
  v_block_end int;
  v_slot_fits boolean := false;
  v_appointment_id uuid;
BEGIN
  IF v_profile_id IS NULL THEN
    RETURN json_build_object(
      'status', 'error',
      'message', 'Inicia sesión para reservar una cita.'
    );
  END IF;

  SELECT m.organization_id INTO v_organization_id
  FROM public.professionals p
  JOIN public.memberships m ON m.id = p.membership_id
  WHERE p.id = p_professional_id
  FOR UPDATE OF p;

  IF v_organization_id IS NULL THEN
    RETURN json_build_object(
      'status', 'error',
      'message', 'Este profesional ya no está disponible.'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE profile_id = v_profile_id
      AND organization_id = v_organization_id
  ) THEN
    RETURN json_build_object(
      'status', 'error',
      'message', 'No tienes permiso para reservar citas en este gimnasio.'
    );
  END IF;

  SELECT s.duration_minutes INTO v_duration
  FROM public.services s
  WHERE s.id = p_service_id
    AND s.professional_id = p_professional_id
    AND s.organization_id = v_organization_id;

  IF v_duration IS NULL THEN
    RETURN json_build_object(
      'status', 'error',
      'message', 'El servicio seleccionado no pertenece a este profesional.'
    );
  END IF;

  IF p_starts_at <= now() THEN
    RETURN json_build_object(
      'status', 'error',
      'message', 'Elige un horario futuro.'
    );
  END IF;

  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  -- Availability blocks are wall-clock times in gym-local time.
  v_day := EXTRACT(DOW FROM p_starts_at AT TIME ZONE 'America/Costa_Rica')::int;
  v_start_minutes :=
    EXTRACT(HOUR FROM p_starts_at AT TIME ZONE 'America/Costa_Rica')::int * 60
    + EXTRACT(MINUTE FROM p_starts_at AT TIME ZONE 'America/Costa_Rica')::int;

  FOR v_block_start, v_block_end IN
    SELECT
      EXTRACT(HOUR FROM a.start_time)::int * 60 + EXTRACT(MINUTE FROM a.start_time)::int,
      EXTRACT(HOUR FROM a.end_time)::int * 60 + EXTRACT(MINUTE FROM a.end_time)::int
    FROM public.availability a
    WHERE a.professional_id = p_professional_id
      AND a.day_of_week = v_day
  LOOP
    IF v_start_minutes >= v_block_start AND v_start_minutes + v_duration <= v_block_end THEN
      v_slot_fits := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT v_slot_fits THEN
    RETURN json_build_object(
      'status', 'error',
      'message', 'Este horario está fuera de la disponibilidad del profesional.'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.profile_id = v_profile_id
      AND a.status <> 'cancelled'
      AND a.starts_at < v_ends_at
      AND a.ends_at > p_starts_at
  ) THEN
    RETURN json_build_object(
      'status', 'member_conflict',
      'message', 'Ya tienes una cita en ese horario.'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.professional_id = p_professional_id
      AND a.status <> 'cancelled'
      AND a.starts_at < v_ends_at
      AND a.ends_at > p_starts_at
  ) THEN
    RETURN json_build_object(
      'status', 'slot_taken',
      'message', 'Ese horario ya está ocupado.'
    );
  END IF;

  INSERT INTO public.appointments
    (organization_id, service_id, professional_id, profile_id, starts_at, ends_at)
  VALUES
    (v_organization_id, p_service_id, p_professional_id, v_profile_id, p_starts_at, v_ends_at)
  RETURNING id INTO v_appointment_id;

  RETURN json_build_object(
    'status', 'confirmed',
    'message', 'Cita reservada',
    'appointment_id', v_appointment_id
  );
END;
$$;

COMMIT;
