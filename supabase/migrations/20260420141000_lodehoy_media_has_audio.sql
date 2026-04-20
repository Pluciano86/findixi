BEGIN;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['publicaciones_hoy', 'publicacions_hoy']
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS media_has_audio boolean', v_table);
  END LOOP;
END
$$;

COMMIT;
