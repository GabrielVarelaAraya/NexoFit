-- NexoFit: appointment security hardening and booking support RPCs.
-- Apply after 000001 through 000007. Re-run this file after re-running
-- 000003 (it replaces the appointment policies that 000003 recreates).
--
-- 1. Members could INSERT appointments directly (policy only checked
--    profile_id = auth.uid()), bypassing every validation in book_appointment,
--    and UPDATE any column of their own appointment. Booking and cancelling
--    now go through SECURITY DEFINER RPCs only.
-- 2. Appointment identity/time columns become immutable.
-- 3. cancel_appointment: member cancellation with ownership checks.
-- 4. get_busy_slots: busy time ranges of a professional, without personal
--    data, so the slot picker can hide taken slots (RLS lets members read
--    only their own appointments).
-- 5. list_org_professionals: professional names/specialties for members
--    (profiles RLS does not let a member read another member's profile).
-- 6. In-app notifications: the professional is told when a member books or
--    cancels; the member is told when someone else cancels their appointment.

BEGIN;

-- ============================================================
-- Policies: no direct member writes
-- ============================================================

DROP POLICY IF EXISTS appointment_insert ON public.appointments;

DROP POLICY IF EXISTS appointment_update ON public.appointments;
CREATE POLICY appointment_update ON public.appointments
FOR UPDATE TO authenticated
USING (public.can_manage_professional(professional_id, organization_id))
WITH CHECK (public.can_manage_professional(professional_id, organization_id));

-- ============================================================
-- Immutable columns
-- ============================================================

CREATE OR REPLACE FUNCTION public.appointments_protect_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.service_id IS DISTINCT FROM OLD.service_id
    OR NEW.professional_id IS DISTINCT FROM OLD.professional_id
    OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
    OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
    OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
  THEN
    RAISE EXCEPTION 'Los datos de la cita no se pueden modificar.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_protect_columns ON public.appointments;
CREATE TRIGGER appointments_protect_columns
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.appointments_protect_columns();

-- ============================================================
-- cancel_appointment
-- Returns json: {status: cancelled | already_cancelled | error, message}
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_appointment(p_appointment_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid := auth.uid();
  v_row public.appointments%ROWTYPE;
  -- Minimum notice to cancel. 0 = any time before the appointment starts.
  v_min_notice interval := interval '0 minutes';
BEGIN
  IF v_profile_id IS NULL THEN
    RETURN json_build_object(
      'status', 'error',
      'message', 'Inicia sesión para cancelar tu cita.'
    );
  END IF;

  SELECT a.* INTO v_row
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.profile_id = v_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'status', 'error',
      'message', 'No encontramos esa cita.'
    );
  END IF;

  IF v_row.status = 'cancelled' THEN
    RETURN json_build_object(
      'status', 'already_cancelled',
      'message', 'La cita ya estaba cancelada.'
    );
  END IF;

  IF v_row.status <> 'confirmed' THEN
    RETURN json_build_object(
      'status', 'error',
      'message', 'Esta cita ya no se puede cancelar.'
    );
  END IF;

  IF v_row.starts_at <= now() + v_min_notice THEN
    RETURN json_build_object(
      'status', 'error',
      'message', 'Ya no es posible cancelar esta cita.'
    );
  END IF;

  UPDATE public.appointments
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = v_row.id;

  RETURN json_build_object('status', 'cancelled', 'message', 'Cita cancelada');
END;
$$;

-- ============================================================
-- get_busy_slots: occupied ranges, no personal data.
-- Empty for callers outside the professional's organization.
-- The range is capped at 62 days.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_busy_slots(
  p_professional_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (busy_start timestamptz, busy_end timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_to timestamptz := LEAST(p_to, p_from + interval '62 days');
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.professionals p
    JOIN public.memberships pm ON pm.id = p.membership_id
    JOIN public.memberships me
      ON me.organization_id = pm.organization_id AND me.profile_id = auth.uid()
    WHERE p.id = p_professional_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT a.starts_at, a.ends_at
  FROM public.appointments a
  WHERE a.professional_id = p_professional_id
    AND a.status <> 'cancelled'
    AND a.starts_at < v_to
    AND a.ends_at > p_from
  ORDER BY a.starts_at;
END;
$$;

-- ============================================================
-- list_org_professionals: professionals of the caller's organizations.
-- ============================================================

CREATE OR REPLACE FUNCTION public.list_org_professionals()
RETURNS TABLE (
  professional_id uuid,
  org_id uuid,
  full_name text,
  specialization text,
  bio text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, m.organization_id, pr.full_name, p.specialization, p.bio
  FROM public.professionals p
  JOIN public.memberships m ON m.id = p.membership_id AND m.role = 'professional'
  JOIN public.profiles pr ON pr.id = m.profile_id
  WHERE m.organization_id IN (
    SELECT me.organization_id FROM public.memberships me WHERE me.profile_id = auth.uid()
  )
  ORDER BY pr.full_name NULLS LAST;
$$;

-- ============================================================
-- Notifications (shown in Perfil -> Notificaciones, live via Realtime)
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_appointment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_professional_profile uuid;
  v_recipient uuid;
  v_title text;
  v_body text;
  v_member_name text;
  v_service text;
  v_when text;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.status <> 'cancelled' OR OLD.status = 'cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT m.profile_id INTO v_professional_profile
  FROM public.professionals p
  JOIN public.memberships m ON m.id = p.membership_id
  WHERE p.id = NEW.professional_id;

  SELECT COALESCE(pr.full_name, 'Un miembro') INTO v_member_name
  FROM public.profiles pr WHERE pr.id = NEW.profile_id;

  SELECT COALESCE(s.name, 'una cita') INTO v_service
  FROM public.services s WHERE s.id = NEW.service_id;

  v_when := to_char(NEW.starts_at AT TIME ZONE 'America/Costa_Rica', 'DD/MM/YYYY HH24:MI');

  IF TG_OP = 'INSERT' THEN
    v_recipient := v_professional_profile;
    v_title := 'Nueva cita reservada';
    v_body := v_member_name || ' reservó ' || v_service || ' el ' || v_when || '.';
  ELSIF auth.uid() IS NOT DISTINCT FROM NEW.profile_id THEN
    -- The member cancelled: tell the professional.
    v_recipient := v_professional_profile;
    v_title := 'Cita cancelada';
    v_body := v_member_name || ' canceló ' || v_service || ' del ' || v_when || '.';
  ELSE
    -- Someone else (professional or admin) cancelled: tell the member.
    v_recipient := NEW.profile_id;
    v_title := 'Tu cita fue cancelada';
    v_body := 'Tu cita de ' || v_service || ' del ' || v_when || ' fue cancelada.';
  END IF;

  -- Never notify the person who just did the action.
  IF v_recipient IS NULL OR v_recipient IS NOT DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (profile_id, organization_id, title, body, type)
  VALUES (v_recipient, NEW.organization_id, v_title, v_body, 'appointment');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_appointment_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS appointments_notify ON public.appointments;
CREATE TRIGGER appointments_notify
AFTER INSERT OR UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_change();

-- ============================================================
-- Realtime: publish appointments so Citas and the professional agenda
-- refresh live (same pattern as 000006; no-op without Supabase Realtime).
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'appointments'
    )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;
END $$;

ALTER TABLE public.appointments REPLICA IDENTITY FULL;

-- ============================================================
-- Execution privileges: signed-in users only (not anon / PUBLIC).
-- ============================================================

REVOKE ALL ON FUNCTION public.book_appointment(uuid, uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_appointment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_busy_slots(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_org_professionals() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.book_appointment(uuid, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_busy_slots(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_org_professionals() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
