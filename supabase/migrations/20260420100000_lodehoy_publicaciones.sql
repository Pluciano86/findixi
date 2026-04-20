BEGIN;

CREATE OR REPLACE FUNCTION public.fn_publicaciones_hoy_expira_en(p_ref timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
DECLARE
  ref_local timestamp;
  fecha_objetivo date;
BEGIN
  ref_local := timezone('America/Puerto_Rico', coalesce(p_ref, now()));

  IF ref_local::time < time '05:00:00' THEN
    fecha_objetivo := ref_local::date;
  ELSE
    fecha_objetivo := (ref_local::date + 1);
  END IF;

  RETURN make_timestamptz(
    EXTRACT(YEAR FROM fecha_objetivo)::int,
    EXTRACT(MONTH FROM fecha_objetivo)::int,
    EXTRACT(DAY FROM fecha_objetivo)::int,
    5,
    0,
    0,
    'America/Puerto_Rico'
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.publicaciones_hoy (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  idcomercio bigint NOT NULL REFERENCES public."Comercios"(id) ON DELETE CASCADE,
  texto text NOT NULL DEFAULT '' CHECK (char_length(texto) <= 280),
  media_path text NOT NULL,
  media_tipo text NOT NULL CHECK (media_tipo IN ('image', 'video')),
  media_mime text NOT NULL CHECK (media_mime IN ('image/jpeg', 'image/png', 'image/gif', 'video/mp4')),
  media_ancho integer,
  media_alto integer,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expira_en timestamptz NOT NULL DEFAULT public.fn_publicaciones_hoy_expira_en(now()),
  CONSTRAINT publicaciones_hoy_media_dims_chk
    CHECK ((media_ancho IS NULL AND media_alto IS NULL) OR (media_ancho > 0 AND media_alto > 0))
);

CREATE OR REPLACE FUNCTION public.fn_publicaciones_hoy_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trg_publicaciones_hoy_before_write ON public.publicaciones_hoy;
CREATE TRIGGER trg_publicaciones_hoy_before_write
BEFORE INSERT OR UPDATE ON public.publicaciones_hoy
FOR EACH ROW
EXECUTE FUNCTION public.fn_publicaciones_hoy_before_write();

CREATE INDEX IF NOT EXISTS publicaciones_hoy_expira_en_idx
  ON public.publicaciones_hoy (expira_en);

CREATE INDEX IF NOT EXISTS publicaciones_hoy_comercio_created_idx
  ON public.publicaciones_hoy (idcomercio, created_at DESC);

ALTER TABLE public.publicaciones_hoy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "publicaciones_hoy_select_activo_publico" ON public.publicaciones_hoy;
CREATE POLICY "publicaciones_hoy_select_activo_publico"
ON public.publicaciones_hoy
FOR SELECT
TO anon, authenticated
USING (expira_en > now());

DROP POLICY IF EXISTS "publicaciones_hoy_select_owner" ON public.publicaciones_hoy;
CREATE POLICY "publicaciones_hoy_select_owner"
ON public.publicaciones_hoy
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public."UsuarioComercios" uc
    WHERE uc."idComercio" = publicaciones_hoy.idcomercio
      AND uc."idUsuario" = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public."Comercios" c
    WHERE c.id = publicaciones_hoy.idcomercio
      AND c.owner_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "publicaciones_hoy_insert_owner" ON public.publicaciones_hoy;
CREATE POLICY "publicaciones_hoy_insert_owner"
ON public.publicaciones_hoy
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1
      FROM public."UsuarioComercios" uc
      WHERE uc."idComercio" = publicaciones_hoy.idcomercio
        AND uc."idUsuario" = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public."Comercios" c
      WHERE c.id = publicaciones_hoy.idcomercio
        AND c.owner_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "publicaciones_hoy_update_owner" ON public.publicaciones_hoy;
CREATE POLICY "publicaciones_hoy_update_owner"
ON public.publicaciones_hoy
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public."UsuarioComercios" uc
    WHERE uc."idComercio" = publicaciones_hoy.idcomercio
      AND uc."idUsuario" = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public."Comercios" c
    WHERE c.id = publicaciones_hoy.idcomercio
      AND c.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public."UsuarioComercios" uc
    WHERE uc."idComercio" = publicaciones_hoy.idcomercio
      AND uc."idUsuario" = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public."Comercios" c
    WHERE c.id = publicaciones_hoy.idcomercio
      AND c.owner_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "publicaciones_hoy_delete_owner" ON public.publicaciones_hoy;
CREATE POLICY "publicaciones_hoy_delete_owner"
ON public.publicaciones_hoy
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public."UsuarioComercios" uc
    WHERE uc."idComercio" = publicaciones_hoy.idcomercio
      AND uc."idUsuario" = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public."Comercios" c
    WHERE c.id = publicaciones_hoy.idcomercio
      AND c.owner_user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.fn_limpiar_publicaciones_hoy_expiradas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_deleted integer := 0;
BEGIN
  DELETE FROM public.publicaciones_hoy
  WHERE expira_en <= now();

  GET DIAGNOSTICS rows_deleted = ROW_COUNT;
  RETURN rows_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_limpiar_publicaciones_hoy_expiradas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_limpiar_publicaciones_hoy_expiradas() TO service_role;

DO $do$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron no disponible en este entorno: %', SQLERRM;
  END;
END
$do$;

DO $do$
DECLARE
  v_jobid bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid
    INTO v_jobid
    FROM cron.job
    WHERE jobname = 'limpiar_publicaciones_hoy_5am_pr'
    LIMIT 1;

    IF v_jobid IS NOT NULL THEN
      PERFORM cron.unschedule(v_jobid);
    END IF;

    PERFORM cron.schedule(
      'limpiar_publicaciones_hoy_5am_pr',
      '0 9 * * *',
      $job$SELECT public.fn_limpiar_publicaciones_hoy_expiradas();$job$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'No se pudo programar el cron de publicaciones_hoy: %', SQLERRM;
END
$do$;

COMMIT;
