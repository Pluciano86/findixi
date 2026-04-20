BEGIN;

DO $$
DECLARE
  v_table text;
  v_constraint text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['publicaciones_hoy', 'publicacions_hoy']
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      CONTINUE;
    END IF;

    FOR v_constraint IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid
      WHERE n.nspname = 'public'
        AND t.relname = v_table
        AND c.contype = 'c'
        AND a.attname = 'media_mime'
        AND a.attnum = ANY (c.conkey)
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', v_table, v_constraint);
    END LOOP;

    EXECUTE format($sql$
      ALTER TABLE public.%I
      ADD CONSTRAINT %I
      CHECK (
        (media_tipo = 'image' AND media_mime IN ('image/jpeg', 'image/png', 'image/gif'))
        OR
        (media_tipo = 'video' AND media_mime IN ('video/mp4', 'video/quicktime', 'video/x-m4v'))
      )
    $sql$, v_table, v_table || '_media_mime_check');
  END LOOP;
END
$$;

COMMIT;
