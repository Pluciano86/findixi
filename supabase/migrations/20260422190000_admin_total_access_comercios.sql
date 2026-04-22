BEGIN;

CREATE OR REPLACE FUNCTION public.fn_is_app_admin(p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role text := lower(coalesce(current_setting('request.jwt.claim.role', true), ''));
  v_role text := '';
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') OR v_jwt_role = 'service_role' THEN
    RETURN true;
  END IF;

  IF p_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT lower(trim(coalesce(u.rol_app, '')))
  INTO v_role
  FROM public.usuarios u
  WHERE u.id = p_uid
  LIMIT 1;

  RETURN v_role IN ('admin', 'superadmin', 'app_admin', 'app_superadmin', 'owner', 'app_owner');
END;
$$;

REVOKE ALL ON FUNCTION public.fn_is_app_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_is_app_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_block_protected_comercio_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  bypass_flag text := coalesce(current_setting('app.findixi_allow_protected_change', true), '');
  is_admin_actor boolean := public.fn_is_app_admin(auth.uid());
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
  IF is_admin_actor OR bypass_flag = 'on' THEN
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

CREATE OR REPLACE FUNCTION public.fn_admin_actualizar_plan_comercio(
  p_id_comercio bigint,
  p_plan_id bigint DEFAULT NULL,
  p_plan_nivel integer DEFAULT NULL,
  p_plan_nombre text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_jwt_role text := lower(coalesce(current_setting('request.jwt.claim.role', true), ''));
  v_plan_nivel integer := greatest(0, least(3, coalesce(p_plan_nivel, 0)));
  v_plan_nombre text := nullif(trim(coalesce(p_plan_nombre, '')), '');
  v_permite_perfil boolean := v_plan_nivel >= 1;
  v_aparece_en_cercanos boolean := v_plan_nivel >= 1;
  v_permite_menu boolean := v_plan_nivel >= 2;
  v_permite_especiales boolean := v_plan_nivel >= 2;
  v_permite_ordenes boolean := v_plan_nivel >= 3;
BEGIN
  IF p_id_comercio IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'idComercio requerido.';
  END IF;

  IF v_jwt_role <> 'service_role' THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Sesion requerida.';
    END IF;

    IF NOT public.fn_is_app_admin(v_uid) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Solo admin puede cambiar planes.';
    END IF;
  END IF;

  IF v_plan_nombre IS NULL THEN
    v_plan_nombre := CASE v_plan_nivel
      WHEN 0 THEN 'Findixi Basic'
      WHEN 1 THEN 'Findixi Regular'
      WHEN 2 THEN 'Findixi Plus'
      WHEN 3 THEN 'Findixi Premium'
      ELSE 'Findixi Basic'
    END;
  END IF;

  PERFORM set_config('app.findixi_allow_protected_change', 'on', true);

  UPDATE public."Comercios"
  SET
    plan_id = p_plan_id,
    plan_nivel = v_plan_nivel,
    plan_nombre = v_plan_nombre,
    permite_perfil = v_permite_perfil,
    aparece_en_cercanos = v_aparece_en_cercanos,
    permite_menu = v_permite_menu,
    permite_especiales = v_permite_especiales,
    permite_ordenes = v_permite_ordenes
  WHERE id = p_id_comercio;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'No se encontro el comercio.';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idComercio', p_id_comercio,
    'plan_id', p_plan_id,
    'plan_nivel', v_plan_nivel,
    'plan_nombre', v_plan_nombre
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_actualizar_plan_comercio(bigint, bigint, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_admin_actualizar_plan_comercio(bigint, bigint, integer, text) TO authenticated, service_role;

COMMIT;
