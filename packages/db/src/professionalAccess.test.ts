import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const id = (number: number) => '00000000-0000-0000-0000-' + String(number).padStart(12, '0');
const migration = (name: string) =>
  readFileSync(new URL('../migrations/' + name, import.meta.url), 'utf8');
let db: PGlite;
let professionalA: string;
let professionalOtherOrg: string;
const professionalB = id(303);
const sql005 = migration('000005_professional_access.sql');

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
  for (let user = 1; user <= 8; user++) {
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
    [203, 100, 3, 'professional'],
    [204, 100, 4, 'member'],
    [205, 100, 5, 'member'],
    [206, 101, 6, 'professional'],
    [207, 100, 7, 'member'],
  ] as const;
  for (const [membership, org, user, role] of members) {
    await db.query(
      'INSERT INTO public.memberships (id, organization_id, profile_id, role) VALUES ($1,$2,$3,$4)',
      [id(membership), id(org), id(user), role]
    );
  }
  await db.query(
    "INSERT INTO public.professionals (id,membership_id,specialization,bio) VALUES ($1,$2,'Nutrition','Existing biography')",
    [professionalB, id(203)]
  );
  await db.exec(sql005);
  const profiles = await db.query<{ id: string; membership_id: string }>(
    'SELECT id,membership_id FROM public.professionals'
  );
  professionalA = profiles.rows.find((row) => row.membership_id === id(202))!.id;
  professionalOtherOrg = profiles.rows.find((row) => row.membership_id === id(206))!.id;
  for (const [service, appointment, availability, professional, org, patient] of [
    [401, 501, 601, professionalA, 100, 4],
    [402, 502, 602, professionalB, 100, 5],
    [403, 503, 603, professionalOtherOrg, 101, 6],
  ] as const) {
    await db.query(
      'INSERT INTO public.services (id,organization_id,professional_id,name,duration_minutes) VALUES ($1,$2,$3,$4,45)',
      [id(service), id(org), professional, 'Consultation']
    );
    await db.query(
      `INSERT INTO public.appointments (id,organization_id,service_id,professional_id,profile_id,starts_at,ends_at)
      VALUES ($1,$2,$3,$4,$5,now()+interval '1 day',now()+interval '1 day 45 minutes')`,
      [id(appointment), id(org), id(service), professional, id(patient)]
    );
    await db.query(
      "INSERT INTO public.availability (id,professional_id,day_of_week,start_time,end_time) VALUES ($1,$2,1,'08:00','09:00')",
      [id(availability), professional]
    );
  }
  await db.exec(
    'GRANT USAGE ON SCHEMA public TO authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;'
  );
}, 30000);

afterAll(async () => {
  if (db) await db.close();
});

describe('professional migration with actual PostgreSQL RLS', () => {
  it('backfills once and preserves existing profile data when re-run', async () => {
    await db.exec(sql005);
    const { rows } = await db.query<{ membership_id: string; count: number }>(
      'SELECT membership_id, count(*)::int AS count FROM public.professionals GROUP BY membership_id'
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.count === 1)).toBe(true);
    const legacy = await db.query<{ specialization: string; bio: string }>(
      'SELECT specialization,bio FROM public.professionals WHERE id=$1',
      [professionalB]
    );
    expect(legacy.rows[0]).toEqual({ specialization: 'Nutrition', bio: 'Existing biography' });
  });
  it('creates one professional profile when an admin assigns the role', async () => {
    await asUser(id(1), "UPDATE public.memberships SET role='professional' WHERE id=$1", [id(207)]);
    await asUser(id(1), "UPDATE public.memberships SET role='professional' WHERE id=$1", [id(207)]);
    const { rows } = await db.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM public.professionals WHERE membership_id=$1',
      [id(207)]
    );
    expect(rows[0].count).toBe(1);
  });
  it('does not let a member elevate their own role', async () => {
    const rows = await asUser(
      id(4),
      "UPDATE public.memberships SET role='professional' WHERE id=$1 RETURNING id",
      [id(204)]
    );
    expect(rows).toHaveLength(0);
  });
  it('shows only assigned appointments to a professional', async () => {
    expect(
      await asUser<{ id: string }>(id(2), 'SELECT id FROM public.appointments ORDER BY id')
    ).toEqual([{ id: id(501) }]);
  });
  it('preserves client access to their own appointments', async () => {
    expect(
      await asUser<{ id: string }>(id(4), 'SELECT id FROM public.appointments ORDER BY id')
    ).toEqual([{ id: id(501) }]);
  });
  it('lets an admin see their organization but not another gym', async () => {
    expect(
      await asUser<{ id: string }>(id(1), 'SELECT id FROM public.appointments ORDER BY id')
    ).toEqual([{ id: id(501) }, { id: id(502) }]);
    expect(await asUser(id(8), 'SELECT id FROM public.appointments')).toHaveLength(0);
  });
  it('exposes assigned patient names without exposing unrelated patient profiles', async () => {
    expect(
      await asUser<{ id: string; full_name: string }>(
        id(2),
        'SELECT id,full_name FROM public.profiles WHERE id IN ($1,$2) ORDER BY id',
        [id(4), id(5)]
      )
    ).toEqual([{ id: id(4), full_name: 'User 4' }]);
  });
  it('blocks updating peer appointments and allows updating own appointments', async () => {
    expect(
      await asUser(
        id(2),
        "UPDATE public.appointments SET status='attended' WHERE id=$1 RETURNING id",
        [id(502)]
      )
    ).toHaveLength(0);
    expect(
      await asUser(
        id(2),
        "UPDATE public.appointments SET status='attended' WHERE id=$1 RETURNING id",
        [id(501)]
      )
    ).toHaveLength(1);
  });
  it('allows own profile editing and prevents editing or transferring to a peer', async () => {
    expect(
      await asUser(
        id(2),
        "UPDATE public.professionals SET specialization='Physiotherapy' WHERE id=$1 RETURNING id",
        [professionalA]
      )
    ).toHaveLength(1);
    expect(
      await asUser(
        id(2),
        "UPDATE public.professionals SET specialization='Changed' WHERE id=$1 RETURNING id",
        [professionalB]
      )
    ).toHaveLength(0);
    await expect(
      asUser(id(2), 'UPDATE public.professionals SET membership_id=$1 WHERE id=$2', [
        id(203),
        professionalA,
      ])
    ).rejects.toThrow(/row-level security/);
  });
  it('allows own availability and blocks peer or other-gym writes', async () => {
    expect(
      await asUser(
        id(2),
        "UPDATE public.availability SET end_time='10:00' WHERE id=$1 RETURNING id",
        [id(601)]
      )
    ).toHaveLength(1);
    expect(
      await asUser(
        id(2),
        "UPDATE public.availability SET end_time='10:00' WHERE id=$1 RETURNING id",
        [id(602)]
      )
    ).toHaveLength(0);
    expect(
      await asUser(id(2), 'DELETE FROM public.availability WHERE id=$1 RETURNING id', [id(602)])
    ).toHaveLength(0);
    await expect(
      asUser(
        id(2),
        "INSERT INTO public.availability (professional_id,day_of_week,start_time,end_time) VALUES ($1,2,'08:00','09:00')",
        [professionalOtherOrg]
      )
    ).rejects.toThrow(/row-level security/);
    expect(
      await asUser(
        id(2),
        "INSERT INTO public.availability (professional_id,day_of_week,start_time,end_time) VALUES ($1,2,'08:00','09:00') RETURNING id",
        [professionalA]
      )
    ).toHaveLength(1);
  });
  it('rejects transferring availability or appointments to a peer', async () => {
    await expect(
      asUser(id(2), 'UPDATE public.availability SET professional_id=$1 WHERE id=$2', [
        professionalB,
        id(601),
      ])
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(id(2), 'UPDATE public.appointments SET professional_id=$1 WHERE id=$2', [
        professionalB,
        id(501),
      ])
    ).rejects.toThrow(/row-level security/);
  });
  it('revokes professional access on demotion while preserving profile and history', async () => {
    await asUser(id(1), "UPDATE public.memberships SET role='member' WHERE id=$1", [id(202)]);
    expect(await asUser(id(2), 'SELECT id FROM public.appointments')).toHaveLength(0);
    expect(
      await asUser(
        id(2),
        "UPDATE public.availability SET end_time='11:00' WHERE id=$1 RETURNING id",
        [id(601)]
      )
    ).toHaveLength(0);
    const { rows } = await db.query('SELECT id FROM public.professionals WHERE id=$1', [
      professionalA,
    ]);
    expect(rows).toHaveLength(1);
  });
});
