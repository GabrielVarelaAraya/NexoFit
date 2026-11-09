-- NexoFit: datos de DEMO para que la app se vea llena.
-- Ejecutar en el SQL Editor de Supabase (rol postgres) DESPUÉS de las migraciones.
-- Se puede ejecutar varias veces: no duplica lo que ya existe.
-- Para quitarlo: demo_cleanup.sql
--
-- Cambia v_member_email por la cuenta con la que vas a mostrar la demo. El
-- script usa el gimnasio (organización) de esa cuenta y crea:
--   · biblioteca de ejercicios, tipos de clase y ~10 días de clases (con
--     reservas, asistencias y rutinas publicadas),
--   · especialidad, servicios y horarios para los profesionales del gimnasio
--     y citas (próximas, pasadas y una cancelada),
--   · para esa cuenta: entrenamientos, récords, medidas y notificaciones.
-- Los datos de clases/citas/ejercicios llevan «[demo]» en la descripción y los
-- de la cuenta «Demo» en las notas, para poder limpiarlos.
--
-- Horario del gimnasio: America/Costa_Rica.

CREATE OR REPLACE FUNCTION pg_temp.demo_nth_weekday(n int) RETURNS date
LANGUAGE plpgsql AS $$
DECLARE
  d date := (now() AT TIME ZONE 'America/Costa_Rica')::date;
  left_days int := abs(n);
  step int := CASE WHEN n < 0 THEN -1 ELSE 1 END;
BEGIN
  WHILE left_days > 0 LOOP
    d := d + step;
    IF EXTRACT(DOW FROM d) NOT IN (0, 6) THEN
      left_days := left_days - 1;
    END IF;
  END LOOP;
  RETURN d;
END;
$$;

DO $demo$
DECLARE
  v_member_email constant text := 'gabovarela373@gmail.com';

  v_today date := (now() AT TIME ZONE 'America/Costa_Rica')::date;
  v_member uuid;
  v_org uuid;
  v_admin_profile uuid;
  v_admin_membership uuid;
  v_venue uuid;
  v_coach uuid;
  v_spaces uuid[];
  v_class_ids uuid[] := '{}';
  v_class_id uuid;
  v_uid uuid;
  v_email text;
  v_people_names text[] := ARRAY[
    'Dra. Laura Mora', 'Lic. Andrés Rojas', 'Camila Vargas',
    'Sofía Jiménez', 'Diego Araya', 'Valeria Quesada', 'Mateo Solano', 'Daniela Campos', 'Esteban Chaves'
  ];
  v_people_roles text[] := ARRAY[
    'professional', 'professional', 'professional',
    'member', 'member', 'member', 'member', 'member', 'member'
  ];
  v_class_names text[] := ARRAY['Yoga', 'Spinning', 'Funcional HIIT', 'Pilates', 'Boxeo fitness'];
  v_class_colors text[] := ARRAY['#0B9B91', '#E4572E', '#F2A541', '#7B6CF6', '#2E86AB'];
  v_class_desc text[] := ARRAY[
    'Flexibilidad, respiración y equilibrio para empezar el día.',
    'Cardio sobre bicicleta con música y mucha energía.',
    'Circuitos de alta intensidad para todo el cuerpo.',
    'Control del core, postura y movilidad.',
    'Golpeo, coordinación y resistencia.'
  ];
  -- Franjas diarias: clase (índice), hora local, duración (min), espacio (índice)
  v_slot_class int[] := ARRAY[1, 2, 3, 4, 5, 3];
  v_slot_time time[] := ARRAY['07:00', '08:30', '12:15', '17:30', '18:45', '06:00'];
  v_slot_min int[] := ARRAY[60, 45, 45, 55, 50, 45];
  v_slot_space int[] := ARRAY[1, 2, 1, 2, 1, 2];
  v_i int;
  v_d int;
  v_start timestamptz;
  v_cap int;
  v_session record;
  v_m record;
  v_p record;
  v_s record;
  v_n int;
  v_exercise_names text[] := ARRAY[
    'Sentadilla trasera', 'Press de banca', 'Peso muerto', 'Press militar', 'Dominadas',
    'Remo con barra', 'Zancadas', 'Curl de bíceps', 'Fondos en paralelas', 'Plancha',
    'Hip thrust', 'Remo en máquina', 'Burpees', 'Carrera en cinta'
  ];
  v_exercise_cat public.exercise_category[] := ARRAY[
    'strength', 'strength', 'strength', 'strength', 'strength', 'strength', 'strength',
    'strength', 'strength', 'strength', 'strength', 'strength', 'cardio', 'cardio'
  ];
  v_exercise_muscle public.muscle_group[] := ARRAY[
    'quadriceps', 'chest', 'hamstrings', 'shoulders', 'back', 'back', 'quadriceps',
    'biceps', 'triceps', 'abs', 'glutes', 'back', 'full_body', 'full_body'
  ];
  v_ex_ids uuid[];
  v_specs text[] := ARRAY['Nutrición deportiva', 'Fisioterapia', 'Entrenamiento personal', 'Psicología del deporte'];
  v_service_names text[] := ARRAY['Valoración inicial', 'Sesión de seguimiento', 'Plan personalizado'];
  v_service_min int[] := ARRAY[45, 30, 60];
  v_service_ids uuid[];
  v_pidx int := 0;
  v_c int;
  v_day date;
  v_hour int;
  v_service uuid;
  v_dur int;
  v_log uuid;
  v_we uuid;
  v_ago int;
  v_ex int;
  v_set int;
  v_weight numeric;
  v_meas uuid;
BEGIN
  SELECT id INTO v_member FROM auth.users WHERE lower(email) = lower(v_member_email);
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'No existe la cuenta % (cambia v_member_email)', v_member_email;
  END IF;

  SELECT organization_id INTO v_org
  FROM public.memberships WHERE profile_id = v_member ORDER BY created_at LIMIT 1;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'La cuenta % no pertenece a ningún gimnasio', v_member_email;
  END IF;

  SELECT id, profile_id INTO v_admin_membership, v_admin_profile
  FROM public.memberships WHERE organization_id = v_org AND role = 'admin'
  ORDER BY created_at LIMIT 1;
  IF v_admin_profile IS NULL THEN v_admin_profile := v_member; END IF;

  -- ---------- Sede y espacios ----------
  SELECT id INTO v_venue FROM public.venues WHERE organization_id = v_org ORDER BY created_at LIMIT 1;
  IF v_venue IS NULL THEN
    INSERT INTO public.venues (organization_id, name, address)
    VALUES (v_org, 'Sede Central', 'San José, Costa Rica') RETURNING id INTO v_venue;
  END IF;

  SELECT array_agg(id ORDER BY created_at) INTO v_spaces
  FROM (
    SELECT sp.id, sp.created_at FROM public.spaces sp
    JOIN public.venues v ON v.id = sp.venue_id
    WHERE v.organization_id = v_org ORDER BY sp.created_at LIMIT 2
  ) x;
  IF v_spaces IS NULL OR array_length(v_spaces, 1) < 1 THEN
    INSERT INTO public.spaces (venue_id, name, capacity) VALUES (v_venue, 'Sala Principal', 16);
    SELECT array_agg(id ORDER BY created_at) INTO v_spaces
    FROM public.spaces WHERE venue_id = v_venue;
  END IF;
  IF array_length(v_spaces, 1) < 2 THEN
    INSERT INTO public.spaces (venue_id, name, capacity) VALUES (v_venue, 'Estudio Funcional', 12);
    SELECT array_agg(id ORDER BY created_at) INTO v_spaces
    FROM (
      SELECT sp.id, sp.created_at FROM public.spaces sp
      JOIN public.venues v ON v.id = sp.venue_id
      WHERE v.organization_id = v_org ORDER BY sp.created_at LIMIT 2
    ) x;
  END IF;

  -- ---------- Coach ----------
  SELECT c.id INTO v_coach FROM public.coaches c
  JOIN public.memberships m ON m.id = c.membership_id
  WHERE m.organization_id = v_org ORDER BY c.created_at LIMIT 1;
  IF v_coach IS NULL AND v_admin_membership IS NOT NULL THEN
    INSERT INTO public.coaches (membership_id, specialization, bio)
    VALUES (v_admin_membership, 'Entrenamiento funcional', 'Coach principal del gimnasio.')
    RETURNING id INTO v_coach;
  END IF;

  -- ---------- Personas demo: 3 profesionales y 6 miembros ----------
  -- Usuarios sin contraseña (no pueden iniciar sesión) con correo @nexofit-demo.test.
  -- Sin profesionales con rol «professional» la pantalla «Reservar cita» sale vacía.
  FOR v_i IN 1..array_length(v_people_names, 1) LOOP
    v_email := 'demo.' || v_i || '@nexofit-demo.test';
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = v_email;
    IF v_uid IS NULL THEN
      v_uid := gen_random_uuid();
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) VALUES (
        v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        v_email, '', now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v_people_names[v_i]), now(), now()
      );
    END IF;
    INSERT INTO public.profiles (id, full_name) VALUES (v_uid, v_people_names[v_i])
    ON CONFLICT (id) DO UPDATE SET full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);
    INSERT INTO public.memberships (organization_id, profile_id, role)
    VALUES (v_org, v_uid, v_people_roles[v_i]::public.role_type)
    ON CONFLICT (organization_id, profile_id) DO NOTHING;
  END LOOP;

  -- ---------- Tipos de clase ----------
  FOR v_i IN 1..array_length(v_class_names, 1) LOOP
    v_class_id := NULL;
    SELECT id INTO v_class_id FROM public.class_types
    WHERE organization_id = v_org AND name = v_class_names[v_i] LIMIT 1;
    IF v_class_id IS NULL THEN
      INSERT INTO public.class_types (organization_id, name, color, description)
      VALUES (v_org, v_class_names[v_i], v_class_colors[v_i], '[demo] ' || v_class_desc[v_i])
      RETURNING id INTO v_class_id;
    END IF;
    v_class_ids := v_class_ids || v_class_id;
  END LOOP;

  -- ---------- Clases: 3 días atrás hasta 9 días adelante (sin domingos) ----------
  FOR v_d IN -3..9 LOOP
    IF EXTRACT(DOW FROM v_today + v_d) = 0 THEN CONTINUE; END IF;
    FOR v_i IN 1..array_length(v_slot_class, 1) LOOP
      IF (v_d + v_i) % 3 = 0 THEN CONTINUE; END IF; -- variar los días
      v_start := ((v_today + v_d)::timestamp + v_slot_time[v_i]) AT TIME ZONE 'America/Costa_Rica';
      v_cap := CASE WHEN v_i % 2 = 0 THEN 8 ELSE NULL END; -- algunas clases con cupo corto
      IF NOT EXISTS (
        SELECT 1 FROM public.sessions
        WHERE class_type_id = v_class_ids[v_slot_class[v_i]]
          AND space_id = v_spaces[LEAST(v_slot_space[v_i], array_length(v_spaces, 1))]
          AND starts_at = v_start
      ) THEN
        INSERT INTO public.sessions (class_type_id, space_id, coach_id, starts_at, ends_at, capacity_override)
        VALUES (
          v_class_ids[v_slot_class[v_i]],
          v_spaces[LEAST(v_slot_space[v_i], array_length(v_spaces, 1))],
          v_coach, v_start, v_start + make_interval(mins => v_slot_min[v_i]), v_cap
        );
      END IF;
    END LOOP;
  END LOOP;

  -- ---------- Reservas ----------
  -- Todos los miembros del gimnasio reservan ~60 % de las clases demo (sin pasar el cupo).
  FOR v_session IN
    SELECT se.id, se.starts_at,
           COALESCE(se.capacity_override, sp.capacity) AS cap
    FROM public.sessions se
    JOIN public.class_types ct ON ct.id = se.class_type_id
    JOIN public.spaces sp ON sp.id = se.space_id
    WHERE ct.organization_id = v_org AND ct.id = ANY (v_class_ids)
  LOOP
    FOR v_m IN SELECT profile_id FROM public.memberships WHERE organization_id = v_org LOOP
      IF abs(hashtext(v_session.id::text || v_m.profile_id::text)) % 100 < 60
         AND (SELECT count(*) FROM public.bookings
              WHERE session_id = v_session.id AND status <> 'cancelled') < v_session.cap THEN
        INSERT INTO public.bookings (session_id, profile_id, status)
        VALUES (
          v_session.id, v_m.profile_id,
          CASE WHEN v_session.starts_at < now() THEN 'attended'::public.booking_status
               ELSE 'confirmed'::public.booking_status END
        )
        ON CONFLICT (session_id, profile_id) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  -- La cuenta de la demo siempre tiene sus próximas 3 clases y 2 asistidas.
  FOR v_session IN
    (SELECT se.id, se.starts_at FROM public.sessions se
      WHERE se.class_type_id = ANY (v_class_ids) AND se.starts_at > now()
      ORDER BY se.starts_at LIMIT 3)
    UNION ALL
    (SELECT se.id, se.starts_at FROM public.sessions se
      WHERE se.class_type_id = ANY (v_class_ids) AND se.starts_at < now()
      ORDER BY se.starts_at DESC LIMIT 2)
  LOOP
    INSERT INTO public.bookings (session_id, profile_id, status)
    VALUES (
      v_session.id, v_member,
      CASE WHEN v_session.starts_at < now() THEN 'attended'::public.booking_status
           ELSE 'confirmed'::public.booking_status END
    )
    ON CONFLICT (session_id, profile_id) DO UPDATE
      SET status = EXCLUDED.status, cancelled_at = NULL;
  END LOOP;

  -- ---------- Rutinas publicadas en las próximas clases ----------
  FOR v_session IN
    SELECT se.id, ct.name FROM public.sessions se
    JOIN public.class_types ct ON ct.id = se.class_type_id
    WHERE ct.id = ANY (v_class_ids) AND se.starts_at > now()
    ORDER BY se.starts_at LIMIT 4
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.workout_programs WHERE session_id = v_session.id) THEN
      INSERT INTO public.workout_programs (session_id, content, published_by)
      VALUES (
        v_session.id,
        E'Rutina de ' || v_session.name || E'\n\nCalentamiento: 8 min\nBloque 1: 4 x 12 sentadillas\nBloque 2: 3 x 10 press de hombro\nBloque 3: 3 x 45 s plancha\nEnfriamiento y estiramientos: 5 min',
        v_admin_profile
      );
    END IF;
  END LOOP;

  -- ---------- Biblioteca de ejercicios ----------
  FOR v_i IN 1..array_length(v_exercise_names, 1) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.exercise_library
      WHERE organization_id = v_org AND lower(name) = lower(v_exercise_names[v_i])
    ) THEN
      INSERT INTO public.exercise_library (organization_id, name, description, category, primary_muscle)
      VALUES (v_org, v_exercise_names[v_i], '[demo] Ejercicio de ejemplo.', v_exercise_cat[v_i], v_exercise_muscle[v_i]);
    END IF;
  END LOOP;

  -- ---------- Profesionales: especialidad, servicios, horarios ----------
  FOR v_p IN
    SELECT p.id, p.specialization, p.bio, m.profile_id
    FROM public.professionals p
    JOIN public.memberships m ON m.id = p.membership_id
    WHERE m.organization_id = v_org
    ORDER BY p.created_at, p.id
  LOOP
    v_pidx := v_pidx + 1;
    UPDATE public.professionals
    SET specialization = CASE WHEN specialization IN ('Por definir', '')
                              THEN v_specs[((v_pidx - 1) % array_length(v_specs, 1)) + 1]
                              ELSE specialization END,
        bio = COALESCE(bio, 'Profesional del gimnasio con años de experiencia acompañando a sus clientes.')
    WHERE id = v_p.id;

    FOR v_i IN 1..array_length(v_service_names, 1) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.services
        WHERE professional_id = v_p.id AND name = v_service_names[v_i]
      ) AND (SELECT count(*) FROM public.services WHERE professional_id = v_p.id) < 3 THEN
        INSERT INTO public.services (organization_id, professional_id, name, description, duration_minutes)
        VALUES (v_org, v_p.id, v_service_names[v_i], '[demo] Cita de ejemplo.', v_service_min[v_i]);
      END IF;
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM public.availability WHERE professional_id = v_p.id) THEN
      INSERT INTO public.availability (professional_id, day_of_week, start_time, end_time)
      SELECT v_p.id, dow, t.s, t.e
      FROM generate_series(1, 5) dow,
           (VALUES ('08:00'::time, '12:00'::time), ('14:00'::time, '18:00'::time)) AS t(s, e);
      INSERT INTO public.availability (professional_id, day_of_week, start_time, end_time)
      VALUES (v_p.id, 6, '08:00', '12:00');
    END IF;
  END LOOP;

  -- ---------- Citas ----------
  -- Cada miembro tiene una cita próxima con cada profesional (distinto de sí mismo).
  FOR v_p IN
    SELECT p.id, m.profile_id
    FROM public.professionals p
    JOIN public.memberships m ON m.id = p.membership_id
    WHERE m.organization_id = v_org
    ORDER BY p.created_at, p.id
  LOOP
    SELECT array_agg(id ORDER BY created_at, id) INTO v_service_ids
    FROM public.services WHERE professional_id = v_p.id;
    IF v_service_ids IS NULL THEN CONTINUE; END IF;
    v_c := 0;
    FOR v_m IN
      SELECT profile_id FROM public.memberships
      WHERE organization_id = v_org AND profile_id <> v_p.profile_id
      ORDER BY (profile_id = v_member) DESC, created_at
    LOOP
      v_c := v_c + 1;
      v_day := pg_temp.demo_nth_weekday(1 + (v_c - 1) / 3);
      v_hour := 9 + ((v_c - 1) % 3);
      v_service := v_service_ids[((v_c - 1) % array_length(v_service_ids, 1)) + 1];
      SELECT duration_minutes INTO v_dur FROM public.services WHERE id = v_service;
      v_start := (v_day::timestamp + make_interval(hours => v_hour)) AT TIME ZONE 'America/Costa_Rica';
      IF NOT EXISTS (
        SELECT 1 FROM public.appointments
        WHERE professional_id = v_p.id AND starts_at = v_start
      ) THEN
        INSERT INTO public.appointments
          (organization_id, service_id, professional_id, profile_id, starts_at, ends_at, status)
        VALUES (v_org, v_service, v_p.id, v_m.profile_id, v_start,
                v_start + make_interval(mins => v_dur), 'confirmed');
      END IF;
      EXIT WHEN v_c >= 9;
    END LOOP;

    -- Historial de la cuenta de la demo: una cita pasada atendida y una cancelada.
    IF v_p.profile_id <> v_member THEN
      v_service := v_service_ids[1];
      SELECT duration_minutes INTO v_dur FROM public.services WHERE id = v_service;
      v_start := (pg_temp.demo_nth_weekday(-3)::timestamp + make_interval(hours => 10)) AT TIME ZONE 'America/Costa_Rica';
      IF NOT EXISTS (SELECT 1 FROM public.appointments WHERE professional_id = v_p.id AND starts_at = v_start) THEN
        INSERT INTO public.appointments
          (organization_id, service_id, professional_id, profile_id, starts_at, ends_at, status)
        VALUES (v_org, v_service, v_p.id, v_member, v_start,
                v_start + make_interval(mins => v_dur), 'attended');
      END IF;
      v_start := (pg_temp.demo_nth_weekday(6)::timestamp + make_interval(hours => 16)) AT TIME ZONE 'America/Costa_Rica';
      IF NOT EXISTS (SELECT 1 FROM public.appointments WHERE professional_id = v_p.id AND starts_at = v_start) THEN
        INSERT INTO public.appointments
          (organization_id, service_id, professional_id, profile_id, starts_at, ends_at, status, cancelled_at)
        VALUES (v_org, v_service, v_p.id, v_member, v_start,
                v_start + make_interval(mins => v_dur), 'cancelled', now());
      END IF;
    END IF;
  END LOOP;

  -- ---------- Entrenamientos y récords de la cuenta ----------
  IF NOT EXISTS (
    SELECT 1 FROM public.workout_logs WHERE profile_id = v_member AND notes LIKE 'Demo ·%'
  ) THEN
    SELECT array_agg(id ORDER BY ord) INTO v_ex_ids
    FROM (
      SELECT el.id, array_position(v_exercise_names, el.name) AS ord
      FROM public.exercise_library el
      WHERE el.organization_id = v_org AND el.name = ANY (v_exercise_names)
    ) x;

    FOR v_i IN 1..5 LOOP
      v_ago := 2 + (v_i - 1) * 3; -- hace 2, 5, 8, 11, 14 días (el más viejo primero al insertar al revés)
      v_start := ((v_today - v_ago)::timestamp + time '18:30') AT TIME ZONE 'America/Costa_Rica';
      INSERT INTO public.workout_logs
        (organization_id, profile_id, status, started_at, completed_at, duration_seconds, notes)
      VALUES (v_org, v_member, 'completed', v_start, v_start + interval '55 minutes', 3300,
              'Demo · ' || (ARRAY['Pierna', 'Empuje', 'Tirón', 'Cuerpo completo', 'Pierna y core'])[v_i])
      RETURNING id INTO v_log;

      FOR v_ex IN 0..2 LOOP
        INSERT INTO public.workout_exercises (workout_log_id, exercise_library_id, order_index)
        VALUES (v_log, v_ex_ids[((v_i + v_ex * 3) % 12) + 1], v_ex)
        RETURNING id INTO v_we;
        FOR v_set IN 1..3 LOOP
          -- cargas que suben con el tiempo: los entrenamientos recientes pesan más
          v_weight := 30 + v_ex * 10 + (v_set - 1) * 2.5 + (6 - v_i) * 1.25;
          INSERT INTO public.exercise_sets (workout_exercise_id, set_number, reps, weight_kg, completed)
          VALUES (v_we, v_set, 12 - v_set, v_weight, true);
        END LOOP;
      END LOOP;
    END LOOP;

    -- Récords: el peso máximo por ejercicio entrenado.
    INSERT INTO public.personal_records
      (organization_id, profile_id, exercise_library_id, record_type, value_numeric, unit, achieved_at)
    SELECT v_org, v_member, we.exercise_library_id, 'max_weight', max(es.weight_kg), 'kg', max(wl.started_at)
    FROM public.workout_logs wl
    JOIN public.workout_exercises we ON we.workout_log_id = wl.id
    JOIN public.exercise_sets es ON es.workout_exercise_id = we.id
    WHERE wl.profile_id = v_member AND wl.notes LIKE 'Demo ·%'
      AND we.exercise_library_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.personal_records pr
        WHERE pr.profile_id = v_member AND pr.exercise_library_id = we.exercise_library_id
          AND pr.record_type = 'max_weight'
      )
    GROUP BY we.exercise_library_id;
  END IF;

  -- ---------- Medidas corporales (una por semana, 6 semanas) ----------
  IF NOT EXISTS (SELECT 1 FROM public.measurements WHERE profile_id = v_member AND notes = 'Demo') THEN
    FOR v_i IN 0..5 LOOP
      INSERT INTO public.measurements (organization_id, profile_id, measured_at, source, notes)
      VALUES (v_org, v_member, ((v_today - (5 - v_i) * 7)::timestamp + time '08:00') AT TIME ZONE 'America/Costa_Rica', 'manual', 'Demo')
      RETURNING id INTO v_meas;
      INSERT INTO public.measurement_values (measurement_id, metric_name, value_numeric, unit) VALUES
        (v_meas, 'Peso', round((78.4 - v_i * 0.55)::numeric, 1), 'kg'),
        (v_meas, 'Grasa corporal', round((22.0 - v_i * 0.35)::numeric, 1), '%'),
        (v_meas, 'Masa muscular', round((33.0 + v_i * 0.2)::numeric, 1), 'kg'),
        (v_meas, 'Cintura', round((86.0 - v_i * 0.6)::numeric, 1), 'cm'),
        (v_meas, 'Brazo', round((32.0 + v_i * 0.15)::numeric, 1), 'cm');
    END LOOP;
  END IF;

  -- ---------- Notificaciones ----------
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE profile_id = v_member AND body LIKE '%(demo)') THEN
    INSERT INTO public.notifications (profile_id, organization_id, title, body, type, read) VALUES
      (v_member, v_org, '¡Bienvenido a NexoFit!', 'Reserva tu primera clase y registra tus entrenamientos. (demo)', 'info', false),
      (v_member, v_org, 'Nueva rutina publicada', 'Tu coach publicó la rutina de la próxima clase. (demo)', 'info', false),
      (v_member, v_org, 'Recordatorio de clase', 'Mañana tienes clase reservada. ¡No faltes! (demo)', 'info', true);
  END IF;

  RAISE NOTICE 'Datos demo listos para % en la organización %', v_member_email, v_org;
END
$demo$;
