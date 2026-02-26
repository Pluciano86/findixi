BEGIN;

CREATE OR REPLACE FUNCTION public.fn_is_comercio_verificado(
  p_estado_propiedad text,
  p_estado_verificacion text,
  p_propietario_verificado boolean
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    lower(coalesce(p_estado_propiedad, '')) = 'verificado'
    AND (
      coalesce(p_propietario_verificado, false) = true
      OR lower(coalesce(p_estado_verificacion, '')) = ANY (
        ARRAY['otp_verificado', 'sms_verificado', 'messenger_verificado', 'manual_aprobado']
      )
    );
$$;

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
  is_verified_owner boolean := public.fn_is_comercio_verificado(
    NEW.estado_propiedad::text,
    NEW.estado_verificacion::text,
    NEW.propietario_verificado
  );
  changed_nombre boolean := (TG_OP = 'UPDATE') AND NEW.nombre IS DISTINCT FROM OLD.nombre;
  changed_logo boolean := (TG_OP = 'UPDATE') AND NEW.logo IS DISTINCT FROM OLD.logo;
  changed_telefono boolean := (TG_OP = 'UPDATE') AND NEW.telefono IS DISTINCT FROM OLD.telefono;
  changed_direccion boolean := (TG_OP = 'UPDATE') AND NEW.direccion IS DISTINCT FROM OLD.direccion;
  changed_lat boolean := (TG_OP = 'UPDATE') AND NEW.latitud IS DISTINCT FROM OLD.latitud;
  changed_lon boolean := (TG_OP = 'UPDATE') AND NEW.longitud IS DISTINCT FROM OLD.longitud;
  changed_geom boolean := (TG_OP = 'UPDATE') AND NEW.geom IS DISTINCT FROM OLD.geom;
  plan_nivel_sanitizado integer := greatest(0, least(3, coalesce(NEW.plan_nivel, 0)));
BEGIN
  IF is_service OR bypass_flag = 'on' THEN
    RETURN NEW;
  END IF;

  IF NOT is_verified_owner THEN
    IF TG_OP = 'UPDATE' AND (
      changed_nombre OR changed_telefono OR changed_direccion OR changed_lat OR changed_lon OR changed_geom
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Propiedad pendiente de verificacion: no puedes editar nombre, telefono, direccion ni coordenadas.';
    END IF;

    IF lower(coalesce(NEW.estado_listing::text, '')) = 'publicado' THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Propiedad pendiente de verificacion: el comercio no puede publicarse aun.';
    END IF;

    NEW.permite_perfil := false;
    NEW.aparece_en_cercanos := false;
    NEW.permite_menu := false;
    NEW.permite_especiales := false;
    NEW.permite_ordenes := false;
    NEW.bloqueo_datos_criticos := true;
  ELSE
    IF TG_OP = 'UPDATE' AND (changed_nombre OR changed_logo OR changed_lat OR changed_lon OR changed_geom) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Cambios bloqueados: nombre, coordenadas y logo requieren solicitud y aprobacion manual de Findixi.';
    END IF;
  END IF;

  IF plan_nivel_sanitizado < 1 THEN
    NEW.permite_perfil := false;
    NEW.aparece_en_cercanos := false;
  END IF;

  IF plan_nivel_sanitizado < 2 THEN
    NEW.permite_menu := false;
    NEW.permite_especiales := false;
  END IF;

  IF plan_nivel_sanitizado < 3 THEN
    NEW.permite_ordenes := false;
  END IF;

  IF lower(coalesce(NEW.estado_propiedad::text, '')) = 'en_disputa' THEN
    NEW.bloqueo_datos_criticos := true;
    NEW.permite_perfil := false;
    NEW.aparece_en_cercanos := false;
    NEW.permite_menu := false;
    NEW.permite_especiales := false;
    NEW.permite_ordenes := false;
    IF lower(coalesce(NEW.estado_listing::text, '')) = 'publicado' THEN
      NEW.estado_listing := 'borrador';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_protected_comercio_changes ON public."Comercios";
CREATE TRIGGER trg_block_protected_comercio_changes
BEFORE INSERT OR UPDATE ON public."Comercios"
FOR EACH ROW
EXECUTE FUNCTION public.fn_block_protected_comercio_changes();

CREATE OR REPLACE FUNCTION public.fn_clover_requires_premium_verified()
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
  raw_new jsonb := to_jsonb(NEW);
  id_comercio_text text;
  id_comercio_value bigint;
  comercio_row record;
  verified_owner boolean;
BEGIN
  IF is_service OR bypass_flag = 'on' THEN
    RETURN NEW;
  END IF;

  id_comercio_text := coalesce(raw_new->>'idComercio', raw_new->>'idcomercio');
  IF id_comercio_text IS NULL OR id_comercio_text !~ '^[0-9]+$' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'No se pudo validar el idComercio para conexion Clover.';
  END IF;
  id_comercio_value := id_comercio_text::bigint;

  SELECT
    c.plan_nivel,
    c.estado_propiedad::text AS estado_propiedad,
    c.estado_verificacion::text AS estado_verificacion,
    c.propietario_verificado
  INTO comercio_row
  FROM public."Comercios" c
  WHERE c.id = id_comercio_value
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'No se encontro el comercio para validar conexion Clover.';
  END IF;

  verified_owner := public.fn_is_comercio_verificado(
    comercio_row.estado_propiedad,
    comercio_row.estado_verificacion,
    comercio_row.propietario_verificado
  );

  IF coalesce(comercio_row.plan_nivel, 0) < 3 OR NOT verified_owner THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Clover requiere plan Premium y propiedad verificada.';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.clover_conexiones') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_clover_requires_premium_verified ON public.clover_conexiones;
    CREATE TRIGGER trg_clover_requires_premium_verified
    BEFORE INSERT OR UPDATE ON public.clover_conexiones
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_clover_requires_premium_verified();
  END IF;
END;
$$;

COMMIT;
