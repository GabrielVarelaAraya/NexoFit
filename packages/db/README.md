# @nexofit/db

Database layer: Supabase (PostgreSQL) migrations, RLS policies, and seed data.

## Structure

- `migrations/` — versioned SQL migrations, applied in order via the Supabase CLI.
- `src/` — optional TS helpers.

## Conventions

- One concern per migration file: `20260101_000000_create_organizations.sql`.
- Every table MUST include `organization_id` (where applicable) and an RLS policy.
- Never commit `service_role` keys; only the public-safe `anon` key is allowed in apps.
- Regenerate shared types after schema changes:

```sh
pnpm --filter @nexofit/core exec supabase gen types typescript --project-id <PROJECT_ID>
```
