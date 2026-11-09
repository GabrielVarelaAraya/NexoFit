# @nexofit/db

Database layer: Supabase (PostgreSQL) schema, functions, RLS policies, and seed data.

## Structure

- `migrations/` — consolidated SQL files, applied in order **via the Supabase
  SQL Editor** (paste the file's contents and click **Run**):

  1. `000001_create_schema.sql` — 29 tables, enums, indexes, triggers
  2. `000002_create_functions.sql` — RPCs (`book_session`, `cancel_booking`,
     `create_organization`, RLS helpers)
  3. `000003_create_rls_policies.sql` — RLS on every table + the final
     policy set
  4. `000004_check_email_exists.sql` — boolean email check before signup
     (confirmed and unconfirmed accounts)

  5. `000005_professional_access.sql` — create professional profiles when roles
     are assigned, backfill existing professional memberships, and restrict
     appointment/availability management to the owning professional or org admin
  6. `000006_realtime.sql` — publish `bookings` and `notifications` to Realtime
  7. `000007_appointment_booking.sql` — `book_appointment` RPC (availability and
     conflict checks, serialized per professional) and service ownership
  8. `000008_appointment_security.sql` — closes direct appointment INSERT/UPDATE
     for members, makes appointment time/member columns immutable, and adds
     `cancel_appointment`, `get_busy_slots` and `list_org_professionals`

  9. `000009_workout_delete.sql` — `DELETE` policy so members can delete their own
     workout logs (exercises and sets cascade)

- `seed/` — optional **demo data** for the SQL Editor: `demo_data.sql` (classes,
  1-on-1 appointments with demo professionals, workouts, measurements; idempotent)
  and `demo_cleanup.sql` (removes only what the demo created). See RUNNING.md.
- `src/` — TS helpers and migration tests.

## Verify professional access

Run `pnpm --filter @nexofit/db test`. The professional tests execute the actual
SQL migrations in an in-memory PostgreSQL instance using PGlite, with a minimal
Supabase Auth schema. Queries run as the `authenticated` role to exercise RLS,
including peer access, organization boundaries, profile assignment, and role
revocation. They do not connect to or change your hosted Supabase database.

Apply all nine migrations in order. Migration `000003` recreates every policy,
so after re-running it also re-run `000005`, `000007`, `000008` and `000009`.
Workout saving/deleting (`workoutSave.test.ts`) and the demo seed
(`demoSeed.test.ts`) are tested the same way.

## Conventions

- Numbered files named `0000NN_<description>.sql`; only the **final state** of
  the schema is kept — no superseded or historical layers.
- Files are **idempotent**: safe to re-run on an existing project
  (`IF NOT EXISTS`, `CREATE OR REPLACE`, recreate only their own policies).
- Every table MUST include `organization_id` (where applicable) and an RLS policy.
- Never commit `service_role` keys; only the public-safe `anon` key is allowed in apps.
- Regenerate shared types after schema changes:

```sh
pnpm --filter @nexofit/core exec supabase gen types typescript --project-id <PROJECT_ID>
```
