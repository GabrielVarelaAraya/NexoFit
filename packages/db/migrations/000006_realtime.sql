-- ============================================================
-- 000006 · REALTIME
-- Publica bookings y notifications en Supabase Realtime para que la app
-- reciba cambios en vivo (cupos, lista de espera y badge de no leídas).
-- Idempotente: solo agrega tablas que aún no están publicadas y no falla
-- si la publicación no existe (p. ej. Postgres sin Supabase).
-- Con RLS, Realtime entrega a cada usuario solo las filas que puede ver.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'bookings'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
  END IF;
END $$;

-- REPLICA IDENTITY FULL: los eventos UPDATE/DELETE incluyen la fila completa,
-- necesaria para que Realtime aplique RLS con profile_id/organization_id.
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
