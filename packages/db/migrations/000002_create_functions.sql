-- NexoFit · 000002 · Functions: RLS helpers + RPCs
--
-- Consolidated final functions (supersedes the old 000002/000003/000007/
-- 000008/000009 files). Idempotent: safe to re-run (CREATE OR REPLACE).
-- Requires 000001_create_schema.sql.
--
-- SECURITY DEFINER functions run as the table owner (postgres), which does
-- not apply RLS. That is what lets policies check memberships without
-- recursing into their own policies.

-- ============================================================
-- RLS helper predicates
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_org_member(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE organization_id = p_organization_id
      AND profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE organization_id = p_organization_id
      AND profile_id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_measurement(p_measurement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.measurements
    WHERE id = p_measurement_id
      AND profile_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_measurement(uuid) TO anon, authenticated, service_role;

-- ============================================================
-- book_session: atomic booking with capacity + waitlist
--
-- Locks the session row first, which serializes concurrent bookings of the
-- same class so the capacity check and waitlist insert cannot race.
-- Returns json: {status: confirmed | waitlisted | already_booked |
-- already_waitlisted | error, message, ...}
-- ============================================================

CREATE OR REPLACE FUNCTION public.book_session(
  p_session_id uuid,
  p_profile_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_space_capacity int;
  v_session_capacity_override int;
  v_effective_capacity int;
  v_current_bookings int;
  v_existing_booking record;
  v_existing_waitlist_position int;
  v_next_waitlist_position int;
BEGIN
  SELECT s.capacity, COALESCE(se.capacity_override, s.capacity)
  INTO v_space_capacity, v_session_capacity_override
  FROM public.sessions se
  JOIN public.spaces s ON s.id = se.space_id
  WHERE se.id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'status', 'error',
      'message', 'Session not found'
    );
  END IF;

  SELECT id, status INTO v_existing_booking
  FROM public.bookings
  WHERE session_id = p_session_id AND profile_id = p_profile_id;

  IF v_existing_booking IS NOT NULL AND v_existing_booking.status = 'confirmed' THEN
    RETURN json_build_object(
      'status', 'already_booked',
      'message', 'You already have a confirmed booking for this session'
    );
  END IF;

  -- Already on the waitlist: report the position instead of raising a
  -- unique-violation error (23505) in the client.
  SELECT position INTO v_existing_waitlist_position
  FROM public.waitlist_positions
  WHERE session_id = p_session_id AND profile_id = p_profile_id;

  IF v_existing_waitlist_position IS NOT NULL THEN
    RETURN json_build_object(
      'status', 'already_waitlisted',
      'message', 'You are already on the waitlist for this session',
      'position', v_existing_waitlist_position
    );
  END IF;

  v_effective_capacity := COALESCE(v_session_capacity_override, v_space_capacity);

  SELECT count(*) INTO v_current_bookings
  FROM public.bookings
  WHERE session_id = p_session_id AND status = 'confirmed';

  IF v_current_bookings < v_effective_capacity THEN
    -- Space available: confirm, reviving a cancelled booking if present.
    IF v_existing_booking IS NOT NULL AND v_existing_booking.status = 'cancelled' THEN
      UPDATE public.bookings
      SET status = 'confirmed', cancelled_at = NULL
      WHERE id = v_existing_booking.id;
    ELSE
      INSERT INTO public.bookings (session_id, profile_id, status)
      VALUES (p_session_id, p_profile_id, 'confirmed');
    END IF;

    RETURN json_build_object(
      'status', 'confirmed',
      'message', 'Booking confirmed',
      'spots_remaining', GREATEST(v_effective_capacity - v_current_bookings - 1, 0)
    );
  ELSE
    -- Class full: always queue the user, even when a cancelled booking row
    -- exists (otherwise the user would be neither booked nor queued).
    INSERT INTO public.waitlist_positions (session_id, profile_id, position)
    VALUES (p_session_id, p_profile_id, (
      SELECT COALESCE(MAX(position), 0) + 1
      FROM public.waitlist_positions
      WHERE session_id = p_session_id
    ))
    RETURNING position INTO v_next_waitlist_position;

    RETURN json_build_object(
      'status', 'waitlisted',
      'message', 'Class is full. You have been added to the waitlist.',
      'position', v_next_waitlist_position
    );
  END IF;
END;
$$;

-- ============================================================
-- cancel_booking: cancels a confirmed booking and promotes the first
-- entry on the waitlist (upsert, so a previously cancelled booking row
-- is revived instead of violating UNIQUE(session_id, profile_id)).
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id uuid,
  p_profile_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_next_waitlist record;
  v_promoted boolean := false;
BEGIN
  SELECT b.session_id INTO v_session_id
  FROM public.bookings b
  WHERE b.id = p_booking_id
    AND b.status = 'confirmed'
    AND (
      b.profile_id = p_profile_id
      OR b.session_id IN (
        SELECT se.id FROM public.sessions se
        JOIN public.class_types ct ON ct.id = se.class_type_id
        WHERE ct.organization_id IN (
          SELECT organization_id FROM public.memberships
          WHERE profile_id = p_profile_id AND role IN ('admin', 'coach')
        )
      )
    );

  IF v_session_id IS NULL THEN
    RETURN json_build_object(
      'status', 'error',
      'message', 'Booking not found, already cancelled, or access denied'
    );
  END IF;

  UPDATE public.bookings
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = p_booking_id AND status = 'confirmed';

  SELECT wp.id, wp.profile_id, wp.position
  INTO v_next_waitlist
  FROM public.waitlist_positions wp
  WHERE wp.session_id = v_session_id
  ORDER BY wp.position ASC
  LIMIT 1
  FOR UPDATE;

  IF v_next_waitlist IS NOT NULL THEN
    -- The promoted profile may already own a cancelled booking row for this
    -- session (they cancelled earlier, then joined the waitlist).
    INSERT INTO public.bookings (session_id, profile_id, status)
    VALUES (v_session_id, v_next_waitlist.profile_id, 'confirmed')
    ON CONFLICT (session_id, profile_id)
    DO UPDATE SET status = 'confirmed', cancelled_at = NULL;

    DELETE FROM public.waitlist_positions WHERE id = v_next_waitlist.id;

    UPDATE public.waitlist_positions
    SET position = position - 1
    WHERE session_id = v_session_id AND position > v_next_waitlist.position;

    v_promoted := true;
  END IF;

  RETURN json_build_object(
    'status', 'cancelled',
    'message', 'Booking cancelled',
    'promoted', v_promoted,
    'promoted_profile', CASE WHEN v_promoted THEN v_next_waitlist.profile_id ELSE NULL END
  );
END;
$$;

-- ============================================================
-- get_session_capacity: live capacity for one session
-- (used by the app because RLS hides other members' bookings from 'member')
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_session_capacity(p_session_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT json_build_object(
    'max_capacity', COALESCE(se.capacity_override, s.capacity),
    'current_bookings', (
      SELECT count(*) FROM public.bookings b
      WHERE b.session_id = p_session_id AND b.status = 'confirmed'
    ),
    'waitlist_count', (
      SELECT count(*) FROM public.waitlist_positions wp
      WHERE wp.session_id = p_session_id
    )
  )
  FROM public.sessions se
  JOIN public.spaces s ON s.id = se.space_id
  WHERE se.id = p_session_id;
$$;

-- ============================================================
-- create_organization: creates a gym and its admin membership atomically.
-- The only way to create an organization (org_insert policy is closed):
-- self-granting admin through plain RLS would let anyone become admin of
-- any gym. Slug is generated from the name (no accents, lowercase,
-- hyphens) with a -2, -3, ... suffix retry while it is taken.
-- Returns json: {status: created | error, organization_id, name, slug}
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_organization(p_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_base text;
  v_slug text;
  v_org_id uuid := NULL;
  v_attempt int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Debes iniciar sesión.');
  END IF;

  IF length(v_name) < 3 THEN
    RETURN json_build_object('status', 'error', 'message', 'El nombre debe tener al menos 3 caracteres.');
  END IF;

  v_name := left(v_name, 80);

  -- Slug base: no accents, lowercase, spaces -> hyphens
  v_base := translate(v_name, 'áéíóúüñÁÉÍÓÚÑ', 'aeiouunAEIOUN');
  v_base := lower(v_base);
  v_base := regexp_replace(v_base, '\s+', '-', 'g');
  v_base := regexp_replace(v_base, '[^a-z0-9-]+', '', 'g');
  v_base := regexp_replace(v_base, '-{2,}', '-', 'g');
  v_base := trim(both '-' from v_base);

  IF v_base = '' THEN
    v_base := 'gimnasio';
  END IF;

  v_base := left(v_base, 50);

  -- Insert with a unique slug: -2, -3, ... if the base is already taken.
  WHILE v_org_id IS NULL LOOP
    v_slug := CASE
      WHEN v_attempt = 0 THEN v_base
      ELSE v_base || '-' || (v_attempt + 1)
    END;

    BEGIN
      INSERT INTO public.organizations (name, slug)
      VALUES (v_name, v_slug)
      RETURNING id INTO v_org_id;
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt > 100 THEN
        RETURN json_build_object(
          'status', 'error',
          'message', 'No se pudo generar un slug único. Prueba con otro nombre.'
        );
      END IF;
    END;
  END LOOP;

  INSERT INTO public.memberships (organization_id, profile_id, role)
  VALUES (v_org_id, v_uid, 'admin');

  RETURN json_build_object(
    'status', 'created',
    'organization_id', v_org_id,
    'name', v_name,
    'slug', v_slug
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization(text) TO anon, authenticated, service_role;
