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

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_table
        AND column_name = 'media_has_audio'
    ) THEN
      EXECUTE format(
        'UPDATE public.%I SET media_has_audio = NULL WHERE media_tipo = %L AND media_has_audio = false',
        v_table,
        'video'
      );
    END IF;
  END LOOP;
END
$$;

COMMIT;
