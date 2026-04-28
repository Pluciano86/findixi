BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'Mensajes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."Mensajes";
  END IF;
END
$$;

COMMIT;
