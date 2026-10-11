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

- `src/` — TS helpers and migration tests.

## Verify professional access

Run `pnpm --filter @nexofit/db test`. The professional tests execute the actual
SQL migrations in an in-memory PostgreSQL instance using PGlite, with a minimal
Supabase Auth schema. Queries run as the `authenticated` role to exercise RLS,
including peer access, organization boundaries, profile assignment, and role
revocation. They do not connect to or change your hosted Supabase database.

Apply all five migrations in order. Migration `000003` recreates every policy,
so always apply `000005` afterward when re-running earlier migrations.

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
