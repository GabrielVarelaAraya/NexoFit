import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const id = (number: number) => '00000000-0000-0000-0000-' + String(number).padStart(12, '0');
const migration = (name: string) =>
  readFileSync(new URL('../migrations/' + name, import.meta.url), 'utf8');
const sql008 = migration('000008_appointment_security.sql');

// Costa Rica is UTC-6 all year (no DST): 15:00Z = 09:00 gym-local time.
const at = (daysAhead: number, hourUtc: number, minutes = 0) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(hourUtc, minutes, 0, 0);
  return d.toISOString();
};

const PRO_A = id(2);
const MEMBER_1 = id(3);
const MEMBER_2 = id(4);
const PRO_B = id(5);
const MEMBER_B = id(6);

let db: PGlite;
let professionalA: string;
let professionalB: string;
const serviceA = id(401);
const serviceB = id(402);

async function asUser<T>(userId: string, sql: string, params: unknown[] = []) {
  await db.exec('SET ROLE authenticated');
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId]);
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");
  }
}

type RpcResult = { status: string; message: string; appointment_id?: string };
const asJson = (value: unknown): RpcResult =>
  (typeof value === 'string' ? JSON.parse(value) : value) as RpcResult;

async function book(userId: string, professional: string, service: string, startsAt: string) {
  const rows = await asUser<{ r: unknown }>(
    userId,
    'SELECT public.book_appointment($1, $2, $3::timestamptz) AS r',
    [professional, service, startsAt]
  );
  return asJson(rows[0].r);
}

async function cancel(userId: string, appointmentId: string) {
  const rows = await asUser<{ r: unknown }>(userId, 'SELECT public.cancel_appointment($1) AS r', [
    appointmentId,
  ]);
  return asJson(rows[0].r);
}

async function insertAppointment(
  profile: string,
  startsAt: string,
  durationMinutes = 45,
  status = 'confirmed'
) {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO public.appointments
      (organization_id, service_id, professional_id, profile_id, starts_at, ends_at, status)
     VALUES ($1, $2, $3, $4, $5::timestamptz, $5::timestamptz + make_interval(mins => $6), $7)
     RETURNING id`,
    [id(100), serviceA, professionalA, profile, startsAt, durationMinutes, status]
  );
  return rows[0].id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
      deleted_at timestamptz
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

  for (let user = 1; user <= 6; user++) {
    await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [
      id(user),
      'user' + user + '@test.local',
    ]);
    await db.query('UPDATE public.profiles SET full_name = $2 WHERE id = $1', [
      id(user),
      'User ' + user,
    ]);
  }
  await db.query(
    "INSERT INTO public.organizations (id,name,slug) VALUES ($1,'Gym A','gym-a'),($2,'Gym B','gym-b')",
    [id(100), id(101)]
  );
  const members = [
    [201, 100, 1, 'admin'],
    [202, 100, 2, 'professional'],
    [203, 100, 3, 'member'],
    [204, 100, 4, 'member'],
    [205, 101, 5, 'professional'],
    [206, 101, 6, 'member'],
  ] as const;
  for (const [membership, org, user, role] of members) {
    await db.query(
      'INSERT INTO public.memberships (id, organization_id, profile_id, role) VALUES ($1,$2,$3,$4)',
      [id(membership), id(org), id(user), role]
    );
  }
  await db.exec(migration('000005_professional_access.sql'));
  await db.exec(migration('000007_appointment_booking.sql'));
  await db.exec(sql008);

  const professionals = await db.query<{ id: string; membership_id: string }>(
    'SELECT id, membership_id FROM public.professionals'
  );
  professionalA = professionals.rows.find((row) => row.membership_id === id(202))!.id;
  professionalB = professionals.rows.find((row) => row.membership_id === id(205))!.id;

  await db.query(
    "UPDATE public.professionals SET specialization='Nutrición', bio='Bio A' WHERE id=$1",
    [professionalA]
  );
  await db.query(
    `INSERT INTO public.services (id,organization_id,professional_id,name,duration_minutes)
     VALUES ($1,$2,$3,'Consulta',45), ($4,$5,$6,'Consulta B',45)`,
    [serviceA, id(100), professionalA, serviceB, id(101), professionalB]
  );
  for (const professional of [professionalA, professionalB]) {
    for (let day = 0; day <= 6; day++) {
      await db.query(
        "INSERT INTO public.availability (professional_id,day_of_week,start_time,end_time) VALUES ($1,$2,'08:00','17:00')",
        [professional, day]
      );
    }
  }
  await db.exec(
    'GRANT USAGE ON SCHEMA public TO authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;'
  );
}, 60000);

afterAll(async () => {
  if (db) await db.close();
});

describe('migration 000008 is re-runnable', () => {
  it('can be applied twice without error', async () => {
    await expect(db.exec(sql008)).resolves.not.toThrow();
  });
});

describe('members cannot bypass book_appointment', () => {
  it('rejects a direct INSERT into appointments', async () => {
    await expect(
      asUser(
        MEMBER_1,
        `INSERT INTO public.appointments
          (organization_id,service_id,professional_id,profile_id,starts_at,ends_at)
         VALUES ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz)`,
        [id(100), serviceA, professionalA, MEMBER_1, at(5, 3), at(5, 4)]
      )
    ).rejects.toThrow();
  });

  it('does not let a member change status or times of their own appointment', async () => {
    const appointmentId = await insertAppointment(MEMBER_1, at(6, 15));
    const statusRows = await asUser(
      MEMBER_1,
      "UPDATE public.appointments SET status='attended' WHERE id=$1 RETURNING id",
      [appointmentId]
    );
    expect(statusRows).toHaveLength(0);
    const timeRows = await asUser(
      MEMBER_1,
      "UPDATE public.appointments SET starts_at = starts_at + interval '1 hour' WHERE id=$1 RETURNING id",
      [appointmentId]
    );
    expect(timeRows).toHaveLength(0);
    const { rows } = await db.query<{ status: string }>(
      'SELECT status FROM public.appointments WHERE id=$1',
      [appointmentId]
    );
    expect(rows[0].status).toBe('confirmed');
  });
});

describe('professional keeps managing attendance, but not appointment identity', () => {
  it('lets the owning professional mark an appointment attended', async () => {
    const appointmentId = await insertAppointment(MEMBER_1, at(7, 15));
    const rows = await asUser(
      PRO_A,
      "UPDATE public.appointments SET status='attended' WHERE id=$1 RETURNING id",
      [appointmentId]
    );
    expect(rows).toHaveLength(1);
  });

  it('blocks changing time or member, even for the professional', async () => {
    const appointmentId = await insertAppointment(MEMBER_1, at(8, 15));
    await expect(
      asUser(
        PRO_A,
        "UPDATE public.appointments SET starts_at = starts_at + interval '1 hour' WHERE id=$1",
        [appointmentId]
      )
    ).rejects.toThrow(/no se pueden modificar/);
    await expect(
      asUser(PRO_A, 'UPDATE public.appointments SET profile_id=$2 WHERE id=$1', [
        appointmentId,
        MEMBER_2,
      ])
    ).rejects.toThrow(/no se pueden modificar/);
  });

  it('does not let a professional of another gym update the appointment', async () => {
    const appointmentId = await insertAppointment(MEMBER_1, at(9, 15));
    const rows = await asUser(
      PRO_B,
      "UPDATE public.appointments SET status='no_show' WHERE id=$1 RETURNING id",
      [appointmentId]
    );
    expect(rows).toHaveLength(0);
  });
});

describe('book_appointment', () => {
  it('confirms a valid slot', async () => {
    const result = await book(MEMBER_1, professionalA, serviceA, at(10, 15));
    expect(result.status).toBe('confirmed');
    expect(result.appointment_id).toBeTruthy();
  });

  it('reports slot_taken when another member books an overlapping time', async () => {
    const result = await book(MEMBER_2, professionalA, serviceA, at(10, 15, 30));
    expect(result.status).toBe('slot_taken');
  });

  it('reports member_conflict when the same member overlaps their own appointment', async () => {
    const result = await book(MEMBER_1, professionalA, serviceA, at(10, 15, 30));
    expect(result.status).toBe('member_conflict');
  });

  it('rejects times outside the professional availability', async () => {
    // 03:00Z = 21:00 gym-local, after the 17:00 end of the block.
    const result = await book(MEMBER_2, professionalA, serviceA, at(11, 3));
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/fuera de la disponibilidad/);
  });

  it('rejects past times', async () => {
    const result = await book(MEMBER_2, professionalA, serviceA, at(-1, 15));
    expect(result.status).toBe('error');
  });

  it('rejects members of another gym', async () => {
    const result = await book(MEMBER_B, professionalA, serviceA, at(12, 15));
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/permiso/);
  });

  it('rejects a service that belongs to another professional', async () => {
    const result = await book(MEMBER_2, professionalA, serviceB, at(12, 15));
    expect(result.status).toBe('error');
  });

  it('allows re-booking a slot after it was cancelled', async () => {
    const first = await book(MEMBER_1, professionalA, serviceA, at(13, 15));
    expect(first.status).toBe('confirmed');
    expect((await cancel(MEMBER_1, first.appointment_id!)).status).toBe('cancelled');
    const second = await book(MEMBER_2, professionalA, serviceA, at(13, 15));
    expect(second.status).toBe('confirmed');
  });
});

describe('cancel_appointment', () => {
  it('lets the owner cancel an upcoming appointment', async () => {
    const appointmentId = await insertAppointment(MEMBER_1, at(14, 15));
    const result = await cancel(MEMBER_1, appointmentId);
    expect(result.status).toBe('cancelled');
    const { rows } = await db.query<{ status: string; cancelled_at: string | null }>(
      'SELECT status, cancelled_at FROM public.appointments WHERE id=$1',
      [appointmentId]
    );
    expect(rows[0].status).toBe('cancelled');
    expect(rows[0].cancelled_at).not.toBeNull();
  });

  it('is idempotent', async () => {
    const appointmentId = await insertAppointment(MEMBER_1, at(15, 15));
    await cancel(MEMBER_1, appointmentId);
    expect((await cancel(MEMBER_1, appointmentId)).status).toBe('already_cancelled');
  });

  it('does not let another member cancel it', async () => {
    const appointmentId = await insertAppointment(MEMBER_1, at(16, 15));
    expect((await cancel(MEMBER_2, appointmentId)).status).toBe('error');
    const { rows } = await db.query<{ status: string }>(
      'SELECT status FROM public.appointments WHERE id=$1',
      [appointmentId]
    );
    expect(rows[0].status).toBe('confirmed');
  });

  it('does not cancel appointments that already started or were attended', async () => {
    const past = await insertAppointment(MEMBER_1, at(-2, 15));
    expect((await cancel(MEMBER_1, past)).status).toBe('error');
    const attended = await insertAppointment(MEMBER_1, at(17, 15), 45, 'attended');
    expect((await cancel(MEMBER_1, attended)).status).toBe('error');
  });
});

describe('get_busy_slots', () => {
  it('returns only time ranges for members of the same gym and skips cancelled ones', async () => {
    const kept = await insertAppointment(MEMBER_1, at(20, 15));
    const dropped = await insertAppointment(MEMBER_1, at(20, 18));
    await cancel(MEMBER_1, dropped);
    const rows = await asUser<Record<string, unknown>>(
      MEMBER_2,
      'SELECT * FROM public.get_busy_slots($1, $2::timestamptz, $3::timestamptz)',
      [professionalA, at(20, 0), at(21, 0)]
    );
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(['busy_end', 'busy_start']);
    expect(kept).toBeTruthy();
  });

  it('returns nothing to members of another gym', async () => {
    const rows = await asUser(
      MEMBER_B,
      'SELECT * FROM public.get_busy_slots($1, $2::timestamptz, $3::timestamptz)',
      [professionalA, at(20, 0), at(21, 0)]
    );
    expect(rows).toHaveLength(0);
  });
});

describe('list_org_professionals', () => {
  it('shows professionals of the caller gym with their names', async () => {
    const rows = await asUser<{
      professional_id: string;
      full_name: string;
      specialization: string;
    }>(
      MEMBER_1,
      'SELECT professional_id, full_name, specialization FROM public.list_org_professionals()'
    );
    expect(rows).toEqual([
      { professional_id: professionalA, full_name: 'User 2', specialization: 'Nutrición' },
    ]);
  });

  it('does not leak professionals across gyms', async () => {
    const rows = await asUser<{ professional_id: string }>(
      MEMBER_B,
      'SELECT professional_id FROM public.list_org_professionals()'
    );
    expect(rows.map((row) => row.professional_id)).toEqual([professionalB]);
  });
});

describe('appointment notifications', () => {
  const notificationsFor = async (profile: string) => {
    const { rows } = await db.query<{ title: string; body: string; type: string }>(
      'SELECT title, body, type FROM public.notifications WHERE profile_id=$1 ORDER BY created_at DESC, id DESC',
      [profile]
    );
    return rows;
  };

  it('tells the professional when a member books, but not the member', async () => {
    const proBefore = (await notificationsFor(PRO_A)).length;
    const memberBefore = (await notificationsFor(MEMBER_2)).length;
    const result = await book(MEMBER_2, professionalA, serviceA, at(25, 15));
    expect(result.status).toBe('confirmed');
    const pro = await notificationsFor(PRO_A);
    expect(pro).toHaveLength(proBefore + 1);
    expect(pro[0].title).toBe('Nueva cita reservada');
    expect(pro[0].body).toMatch(/^User 4 reservó Consulta el \d{2}\/\d{2}\/\d{4} 09:00\.$/);
    expect(pro[0].type).toBe('appointment');
    expect(await notificationsFor(MEMBER_2)).toHaveLength(memberBefore);
  });

  it('tells the professional when the member cancels, once', async () => {
    const booked = await book(MEMBER_2, professionalA, serviceA, at(26, 15));
    const before = (await notificationsFor(PRO_A)).length;
    await cancel(MEMBER_2, booked.appointment_id!);
    await cancel(MEMBER_2, booked.appointment_id!);
    const pro = await notificationsFor(PRO_A);
    expect(pro).toHaveLength(before + 1);
    expect(pro[0].title).toBe('Cita cancelada');
  });

  it('tells the member when the professional cancels, but not the professional', async () => {
    const appointmentId = await insertAppointment(MEMBER_1, at(27, 15));
    const proBefore = (await notificationsFor(PRO_A)).length;
    const memberBefore = (await notificationsFor(MEMBER_1)).length;
    const rows = await asUser(
      PRO_A,
      "UPDATE public.appointments SET status='cancelled', cancelled_at=now() WHERE id=$1 RETURNING id",
      [appointmentId]
    );
    expect(rows).toHaveLength(1);
    const member = await notificationsFor(MEMBER_1);
    expect(member).toHaveLength(memberBefore + 1);
    expect(member[0].title).toBe('Tu cita fue cancelada');
    expect(await notificationsFor(PRO_A)).toHaveLength(proBefore);
  });

  it('does not notify when attendance is recorded', async () => {
    const appointmentId = await insertAppointment(MEMBER_1, at(28, 15));
    const memberBefore = (await notificationsFor(MEMBER_1)).length;
    await asUser(PRO_A, "UPDATE public.appointments SET status='attended' WHERE id=$1", [
      appointmentId,
    ]);
    expect(await notificationsFor(MEMBER_1)).toHaveLength(memberBefore);
  });
});
