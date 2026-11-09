-- NexoFit: quita los datos de DEMO creados por demo_data.sql.
-- Ejecutar en el SQL Editor de Supabase. No toca nada que no lleve la marca demo.
-- Se conservan la sede/espacios, el coach, y la especialidad/horarios de los
-- profesionales (pueden ser datos reales).

BEGIN;

-- Personas demo (correo @nexofit-demo.test): primero sus citas (la FK a services es
-- RESTRICT) y luego los usuarios, que arrastran perfil, membresía, reservas y servicios.
DELETE FROM public.appointments
WHERE profile_id IN (SELECT id FROM auth.users WHERE email LIKE '%@nexofit-demo.test')
   OR professional_id IN (
     SELECT p.id FROM public.professionals p
     JOIN public.memberships m ON m.id = p.membership_id
     WHERE m.profile_id IN (SELECT id FROM auth.users WHERE email LIKE '%@nexofit-demo.test')
   );

-- Citas de servicios demo (la FK a services es RESTRICT) y los servicios.
DELETE FROM public.appointments
WHERE service_id IN (SELECT id FROM public.services WHERE description LIKE '[demo]%');
DELETE FROM public.services WHERE description LIKE '[demo]%';

-- Tipos de clase demo: arrastra sus clases, reservas y rutinas (ON DELETE CASCADE).
DELETE FROM public.class_types WHERE description LIKE '[demo]%';

-- Entrenamientos, récords y medidas de la demo.
DELETE FROM public.personal_records
WHERE exercise_library_id IN (SELECT id FROM public.exercise_library WHERE description LIKE '[demo]%');
DELETE FROM public.workout_logs WHERE notes LIKE 'Demo ·%';
DELETE FROM public.measurements WHERE notes = 'Demo';

-- Ejercicios de la biblioteca demo que ya nadie usa.
DELETE FROM public.exercise_library el
WHERE el.description LIKE '[demo]%'
  AND NOT EXISTS (SELECT 1 FROM public.workout_exercises we WHERE we.exercise_library_id = el.id);

-- Las notificaciones «Nueva cita reservada» que generaron las citas demo no se
-- pueden distinguir de las reales: bórralas a mano desde la app si molestan.
DELETE FROM public.notifications WHERE body LIKE '%(demo)';
DELETE FROM auth.users WHERE email LIKE '%@nexofit-demo.test';

COMMIT;
