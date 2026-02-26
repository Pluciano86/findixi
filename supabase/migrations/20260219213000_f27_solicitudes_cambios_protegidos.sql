BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.solicitudes_cambio_comercio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idComercio" bigint NOT NULL REFERENCES public."Comercios"(id) ON DELETE CASCADE,
  user_id uuid,
  campo text NOT NULL CHECK (campo IN ('nombre', 'coordenadas', 'logo')),
  valor_actual jsonb NOT NULL DEFAULT '{}'::jsonb,
  valor_solicitado jsonb NOT NULL DEFAULT '{}'::jsonb,
  motivo text,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  revisado_por uuid,
  revisado_en timestamptz,
  nota_revision text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solicitudes_cambio_comercio_comercio_idx
  ON public.solicitudes_cambio_comercio ("idComercio", created_at DESC);

CREATE INDEX IF NOT EXISTS solicitudes_cambio_comercio_estado_idx
  ON public.solicitudes_cambio_comercio (estado, created_at DESC);

CREATE INDEX IF NOT EXISTS solicitudes_cambio_comercio_user_idx
  ON public.solicitudes_cambio_comercio (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.fn_touch_updated_at_solicitudes_cambio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_updated_at_solicitudes_cambio ON public.solicitudes_cambio_comercio;
CREATE TRIGGER trg_touch_updated_at_solicitudes_cambio
BEFORE UPDATE ON public.solicitudes_cambio_comercio
FOR EACH ROW
EXECUTE FUNCTION public.fn_touch_updated_at_solicitudes_cambio();

CREATE OR REPLACE FUNCTION public.fn_block_protected_comercio_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  bypass_flag text := coalesce(current_setting('app.findixi_allow_protected_change', true), '');
  is_service boolean := (
    current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR jwt_role = 'service_role'
  );
  is_verified_owner boolean := coalesce(OLD.estado_propiedad::text, '') = 'verificado';
  changed_nombre boolean := NEW.nombre IS DISTINCT FROM OLD.nombre;
  changed_logo boolean := NEW.logo IS DISTINCT FROM OLD.logo;
  changed_lat boolean := NEW.latitud IS DISTINCT FROM OLD.latitud;
  changed_lon boolean := NEW.longitud IS DISTINCT FROM OLD.longitud;
  changed_geom boolean := NEW.geom IS DISTINCT FROM OLD.geom;
BEGIN
  IF NOT is_verified_owner THEN
    RETURN NEW;
  END IF;

  IF is_service OR bypass_flag = 'on' THEN
    RETURN NEW;
  END IF;

  IF changed_nombre OR changed_logo OR changed_lat OR changed_lon OR changed_geom THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Cambios bloqueados: nombre, coordenadas y logo requieren solicitud y aprobacion manual de Findixi.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_protected_comercio_changes ON public."Comercios";
CREATE TRIGGER trg_block_protected_comercio_changes
BEFORE UPDATE ON public."Comercios"
FOR EACH ROW
EXECUTE FUNCTION public.fn_block_protected_comercio_changes();

COMMIT;
