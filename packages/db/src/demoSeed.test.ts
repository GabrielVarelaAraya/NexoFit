import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const id = (number: number) => '00000000-0000-0000-0000-' + String(number).padStart(12, '0');
const migration = (name: string) =>
  readFileSync(new URL('../migrations/' + name, import.meta.url), 'utf8');
const seed = (name: string) => readFileSync(new URL('../seed/' + name, import.meta.url), 'utf8');

const DEMO_EMAIL = 'gabovarela373@gmail.com';
const ORG = id(100);
const OTHER_ORG = id(101);

let db: PGlite;

const count = async (sql: string, params: unknown[] = []) =>
  Number((await db.query<{ n: string }>(sql, params)).rows[0].n);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
      deleted_at timestamptz, instance_id uuid, aud text, role text, encrypted_password text,
      email_confirmed_at timestamptz, raw_app_meta_data jsonb, created_at timestamptz, updated_at timestamptz
    );
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
  `);
  for (const name of [
    '000001_create_schema.sql',
    '000002_create_functions.sql',
    '000003_create_rls_policies.sql',
    '000004_check_email_exists.sql',
  ])
    await db.exec(migration(name));

  const users: [number, string][] = [
    [1, 'admin@test.local'],
    [2, 'pro@test.local'],
    [3, DEMO_EMAIL],
    [4, 'member2@test.local'],
    [5, 'outsider@test.local'],
  ];
  for (const [user, email] of users) {
    await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [id(user), email]);
  }
  await db.query(
    "INSERT INTO public.organizations (id,name,slug) VALUES ($1,'Gym A','gym-a'),($2,'Gym B','gym-b')",
    [ORG, OTHER_ORG]
  );
  const memberships = [
    [201, ORG, 1, 'admin'],
    [202, ORG, 2, 'professional'],
    [203, ORG, 3, 'member'],
    [204, ORG, 4, 'member'],
    [205, OTHER_ORG, 5, 'member'],
  ] as const;
  for (const [membership, org, user, role] of memberships) {
    await db.query(
      'INSERT INTO public.memberships (id, organization_id, profile_id, role) VALUES ($1,$2,$3,$4)',
      [id(membership), org, id(user), role]
    );
  }
  for (const name of [
    '000005_professional_access.sql',
    '000007_appointment_booking.sql',
    '000008_appointment_security.sql',
  ])
    await db.exec(migration(name));
}, 60000);

afterAll(async () => {
  if (db) await db.close();
});

describe('demo seed', () => {
  it('fills classes, bookings, appointments, workouts, measurements and notifications', async () => {
    await db.exec(seed('demo_data.sql'));

    expect(
      await count("SELECT count(*) n FROM public.class_types WHERE description LIKE '[demo]%'")
    ).toBe(5);
    expect(
      await count('SELECT count(*) n FROM public.sessions WHERE starts_at > now()')
    ).toBeGreaterThan(15);
    expect(
      await count('SELECT count(*) n FROM public.sessions WHERE starts_at < now()')
    ).toBeGreaterThan(3);
    expect(
      await count(
        "SELECT count(*) n FROM public.bookings WHERE profile_id = $1 AND status = 'confirmed'",
        [id(3)]
      )
    ).toBeGreaterThanOrEqual(3);
    expect(await count('SELECT count(*) n FROM public.workout_programs')).toBeGreaterThan(0);

    // 3 profesionales demo + el que ya existía: los 4 salen en «Reservar cita».
    expect(
      await count("SELECT count(*) n FROM public.memberships WHERE role = 'professional'")
    ).toBe(4);
    // Cada profesional queda con especialidad, 3 servicios y horarios.
    const pro = await db.query<{ specialization: string }>(
      'SELECT specialization FROM public.professionals'
    );
    expect(pro.rows[0].specialization).not.toBe('Por definir');
    expect(await count('SELECT count(*) n FROM public.services')).toBe(12);
    expect(await count('SELECT count(*) n FROM public.availability')).toBe(44);

    // Citas: próximas, una atendida y una cancelada para la cuenta de la demo.
    expect(
      await count(
        "SELECT count(*) n FROM public.appointments WHERE profile_id = $1 AND status = 'confirmed' AND starts_at > now()",
        [id(3)]
      )
    ).toBe(4); // una por profesional
    expect(
      await count("SELECT count(*) n FROM public.appointments WHERE status = 'attended'")
    ).toBe(4);
    expect(
      await count("SELECT count(*) n FROM public.appointments WHERE status = 'cancelled'")
    ).toBe(4);

    // Progreso de la cuenta.
    expect(
      await count(
        "SELECT count(*) n FROM public.workout_logs WHERE status = 'completed' AND profile_id = $1",
        [id(3)]
      )
    ).toBe(5);
    expect(await count('SELECT count(*) n FROM public.exercise_sets')).toBe(45);
    expect(await count('SELECT count(*) n FROM public.personal_records')).toBeGreaterThan(0);
    expect(await count("SELECT count(*) n FROM public.measurements WHERE notes = 'Demo'")).toBe(6);
    expect(
      await count("SELECT count(*) n FROM public.notifications WHERE body LIKE '%(demo)'")
    ).toBe(3);
  });

  it('does not touch the other gym, and never overbooks a class', async () => {
    expect(
      await count('SELECT count(*) n FROM public.class_types WHERE organization_id = $1', [
        OTHER_ORG,
      ])
    ).toBe(0);
    const overbooked = await count(
      `SELECT count(*) n FROM public.sessions se
       JOIN public.spaces sp ON sp.id = se.space_id
       WHERE (SELECT count(*) FROM public.bookings b WHERE b.session_id = se.id AND b.status <> 'cancelled')
             > COALESCE(se.capacity_override, sp.capacity)`
    );
    expect(overbooked).toBe(0);
  });

  it('is safe to run again (no duplicates)', async () => {
    const before = {
      sessions: await count('SELECT count(*) n FROM public.sessions'),
      appointments: await count('SELECT count(*) n FROM public.appointments'),
      logs: await count('SELECT count(*) n FROM public.workout_logs'),
      services: await count('SELECT count(*) n FROM public.services'),
    };
    await db.exec(seed('demo_data.sql'));
    expect({
      sessions: await count('SELECT count(*) n FROM public.sessions'),
      appointments: await count('SELECT count(*) n FROM public.appointments'),
      logs: await count('SELECT count(*) n FROM public.workout_logs'),
      services: await count('SELECT count(*) n FROM public.services'),
    }).toEqual(before);
  });

  it('cleanup removes the demo data', async () => {
    await db.exec(seed('demo_cleanup.sql'));
    expect(await count('SELECT count(*) n FROM public.sessions')).toBe(0);
    expect(await count('SELECT count(*) n FROM public.appointments')).toBe(0);
    expect(await count('SELECT count(*) n FROM public.workout_logs')).toBe(0);
    expect(await count('SELECT count(*) n FROM public.measurements')).toBe(0);
    expect(
      await count("SELECT count(*) n FROM auth.users WHERE email LIKE '%@nexofit-demo.test'")
    ).toBe(0);
    expect(await count('SELECT count(*) n FROM public.memberships')).toBe(5);
    expect(await count('SELECT count(*) n FROM public.services')).toBe(0);
    expect(await count('SELECT count(*) n FROM public.exercise_library')).toBe(0);
  });
});
