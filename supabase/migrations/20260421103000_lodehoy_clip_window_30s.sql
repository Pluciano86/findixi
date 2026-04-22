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

    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS clip_start_sec numeric(8,3)', v_table);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS clip_end_sec numeric(8,3)', v_table);

    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', v_table, v_table || '_clip_window_check');
    EXECUTE format($sql$
      ALTER TABLE public.%I
      ADD CONSTRAINT %I
      CHECK (
        (
          media_tipo = 'video' AND (
            (clip_start_sec IS NULL AND clip_end_sec IS NULL)
            OR (
              clip_start_sec IS NOT NULL
              AND clip_end_sec IS NOT NULL
              AND clip_start_sec >= 0
              AND clip_end_sec > clip_start_sec
              AND (clip_end_sec - clip_start_sec) <= 30.0
            )
          )
        )
        OR (
          media_tipo <> 'video'
          AND clip_start_sec IS NULL
          AND clip_end_sec IS NULL
        )
      )
    $sql$, v_table, v_table || '_clip_window_check');
  END LOOP;
END
$$;

COMMIT;

