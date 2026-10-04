# @nexofit/db

Database layer: Supabase (PostgreSQL) schema, functions, RLS policies, and seed data.

## Structure

- `migrations/` — consolidated SQL files, applied in order **via the Supabase
  SQL Editor** (paste the file's contents and click **Run**):

  1. `000001_create_schema.sql` — 27 tables, enums, indexes, triggers
  2. `000002_create_functions.sql` — RPCs (`book_session`, `cancel_booking`,
     `create_organization`, RLS helpers)
  3. `000003_create_rls_policies.sql` — RLS on every table + the final
     policy set

- `src/` — optional TS helpers.

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
