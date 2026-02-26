BEGIN;

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
  v_rol_app text := '';
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

    SELECT lower(trim(coalesce(u.rol_app, '')))
    INTO v_rol_app
    FROM public.usuarios u
    WHERE u.id = v_uid
    LIMIT 1;

    IF v_rol_app NOT IN ('admin', 'superadmin', 'app_admin', 'app_superadmin') THEN
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
