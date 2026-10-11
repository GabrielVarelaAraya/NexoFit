-- NexoFit: check email availability before registration.
-- Apply after 000001, 000002 and 000003 in the Supabase SQL Editor.
-- Idempotent. Returns only whether an active account uses the exact address.
-- Includes confirmed and unconfirmed accounts; does not expose user records.

BEGIN;

CREATE OR REPLACE FUNCTION public.email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users AS u
    WHERE pg_catalog.lower(u.email) = pg_catalog.lower(pg_catalog.btrim(p_email))
      AND u.deleted_at IS NULL
  );
$$;

-- Registration runs before login, so anon intentionally gets this boolean.
REVOKE ALL ON FUNCTION public.email_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_exists(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
