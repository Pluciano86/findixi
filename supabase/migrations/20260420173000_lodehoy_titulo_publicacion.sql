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

    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS titulo text NOT NULL DEFAULT %L',
      v_table,
      ''
    );

    FOR v_constraint IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid
      WHERE n.nspname = 'public'
        AND t.relname = v_table
        AND c.contype = 'c'
        AND a.attname = 'titulo'
        AND a.attnum = ANY (c.conkey)
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', v_table, v_constraint);
    END LOOP;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (char_length(coalesce(titulo, %L)) <= 50)',
      v_table,
      v_table || '_titulo_len_check',
      ''
    );
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.fn_publicaciones_hoy_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.titulo := left(btrim(coalesce(NEW.titulo, '')), 50);
  NEW.texto := left(btrim(coalesce(NEW.texto, '')), 280);

  IF NEW.created_at IS NULL THEN
    NEW.created_at := now();
  END IF;

  IF NEW.expira_en IS NULL OR NEW.expira_en <= NEW.created_at THEN
    NEW.expira_en := public.fn_publicaciones_hoy_expira_en(NEW.created_at);
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  v_table text;
  v_trigger text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['publicaciones_hoy', 'publicacions_hoy']
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      CONTINUE;
    END IF;

    v_trigger := format('trg_%s_before_write', v_table);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_trigger, v_table);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_publicaciones_hoy_before_write()',
      v_trigger,
      v_table
    );
  END LOOP;
END
$$;

COMMIT;
