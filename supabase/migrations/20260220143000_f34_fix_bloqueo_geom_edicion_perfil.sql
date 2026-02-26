BEGIN;

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
  branding_aprobado boolean := coalesce(NEW.logo_aprobado, false) = true AND coalesce(NEW.portada_aprobada, false) = true;
  changed_nombre boolean := (TG_OP = 'UPDATE') AND NEW.nombre IS DISTINCT FROM OLD.nombre;
  changed_logo boolean := (TG_OP = 'UPDATE') AND NEW.logo IS DISTINCT FROM OLD.logo;
  changed_telefono boolean := (TG_OP = 'UPDATE') AND NEW.telefono IS DISTINCT FROM OLD.telefono;
  changed_direccion boolean := (TG_OP = 'UPDATE') AND NEW.direccion IS DISTINCT FROM OLD.direccion;
  changed_lat boolean := (TG_OP = 'UPDATE') AND NEW.latitud IS DISTINCT FROM OLD.latitud;
  changed_lon boolean := (TG_OP = 'UPDATE') AND NEW.longitud IS DISTINCT FROM OLD.longitud;
  horarios_configurados integer := 0;
  plan_nivel_sanitizado integer := greatest(0, least(3, coalesce(NEW.plan_nivel, 0)));
BEGIN
  IF is_service OR bypass_flag = 'on' THEN
    RETURN NEW;
  END IF;

  IF NOT is_verified_owner THEN
    IF TG_OP = 'UPDATE' AND (
      changed_nombre OR changed_telefono OR changed_direccion OR changed_lat OR changed_lon
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
    IF TG_OP = 'UPDATE' AND (changed_nombre OR changed_logo OR changed_lat OR changed_lon) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Cambios bloqueados: nombre, coordenadas y logo requieren solicitud y aprobacion manual de Findixi.';
    END IF;
  END IF;

  IF lower(coalesce(NEW.estado_listing::text, '')) = 'publicado' AND NOT branding_aprobado THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'No se puede publicar: logo y portada deben estar aprobados por validacion.';
  END IF;

  IF lower(coalesce(NEW.estado_listing::text, '')) = 'publicado' THEN
    SELECT count(DISTINCT h."diaSemana")
    INTO horarios_configurados
    FROM public."Horarios" h
    WHERE h."idComercio" = NEW.id;

    IF coalesce(horarios_configurados, 0) < 7 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'No se puede publicar: el horario es obligatorio (7 dias configurados), incluyendo plan Basic.';
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

COMMIT;
