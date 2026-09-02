-- Migration 000003: Atomic booking and cancellation functions
-- Prevents overbooking races via SELECT ... FOR UPDATE

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
  v_next_waitlist record;
BEGIN
  SELECT id, status INTO v_existing_booking
  FROM public.bookings
  WHERE session_id = p_session_id AND profile_id = p_profile_id;

  IF v_existing_booking IS NOT NULL AND v_existing_booking.status = 'confirmed' THEN
    RETURN json_build_object(
      'status', 'already_booked',
      'message', 'You already have a confirmed booking for this session'
    );
  END IF;

  SELECT s.capacity, COALESCE(se.capacity_override, s.capacity)
  INTO v_space_capacity, v_session_capacity_override
  FROM public.sessions se
  JOIN public.spaces s ON s.id = se.space_id
  WHERE se.id = p_session_id
  FOR UPDATE;

  v_effective_capacity := COALESCE(v_session_capacity_override, v_space_capacity);

  SELECT count(*) INTO v_current_bookings
  FROM public.bookings
  WHERE session_id = p_session_id AND status = 'confirmed';

  IF v_current_bookings < v_effective_capacity THEN
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
      'spots_remaining', v_effective_capacity - v_current_bookings - 1
    );
  ELSE
    IF v_existing_booking IS NULL THEN
      INSERT INTO public.waitlist_positions (session_id, profile_id, position)
      VALUES (p_session_id, p_profile_id, (
        SELECT COALESCE(MAX(position), 0) + 1
        FROM public.waitlist_positions
        WHERE session_id = p_session_id
      ));
    END IF;

    SELECT position INTO v_next_waitlist
    FROM public.waitlist_positions
    WHERE session_id = p_session_id AND profile_id = p_profile_id;

    RETURN json_build_object(
      'status', 'waitlisted',
      'message', 'Class is full. You have been added to the waitlist.',
      'position', v_next_waitlist
    );
  END IF;
END;
$$;

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
    INSERT INTO public.bookings (session_id, profile_id, status)
    VALUES (v_session_id, v_next_waitlist.profile_id, 'confirmed');

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
