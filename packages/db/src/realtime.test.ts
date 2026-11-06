import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../migrations/000006_realtime.sql', import.meta.url),
  'utf8'
);

async function publicationTables(db: PGlite) {
  const result = await db.query<{ tablename: string }>(
    `SELECT tablename
     FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
     ORDER BY tablename`
  );
  return result.rows.map((row) => row.tablename);
}

describe('realtime migration (000006)', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE PUBLICATION supabase_realtime;
      CREATE TABLE public.bookings (id uuid PRIMARY KEY, profile_id uuid);
      CREATE TABLE public.notifications (id uuid PRIMARY KEY, profile_id uuid);
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it('publishes bookings and notifications', async () => {
    await db.exec(migration);

    expect(await publicationTables(db)).toEqual(['bookings', 'notifications']);
  });

  it('is idempotent when re-run', async () => {
    await db.exec(migration);

    expect(await publicationTables(db)).toEqual(['bookings', 'notifications']);
  });

  it('sets replica identity full on both tables', async () => {
    const result = await db.query<{ relname: string; relreplident: string }>(
      `SELECT relname, relreplident
       FROM pg_class
       WHERE relname IN ('bookings', 'notifications')
       ORDER BY relname`
    );

    expect(result.rows).toEqual([
      { relname: 'bookings', relreplident: 'f' },
      { relname: 'notifications', relreplident: 'f' },
    ]);
  });
});

describe('realtime migration without a publication', () => {
  it('does not fail on plain Postgres', async () => {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE public.bookings (id uuid PRIMARY KEY);
      CREATE TABLE public.notifications (id uuid PRIMARY KEY);
    `);

    // Sin la publicación de Supabase, el bloque DO se omite en vez de fallar.
    await db.exec(migration);

    await db.close();
  });
});
