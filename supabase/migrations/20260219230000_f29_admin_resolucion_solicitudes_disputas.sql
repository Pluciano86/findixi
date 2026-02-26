BEGIN;

ALTER TABLE public.disputas_comercio
  ADD COLUMN IF NOT EXISTS revisado_por uuid,
  ADD COLUMN IF NOT EXISTS revisado_en timestamptz,
  ADD COLUMN IF NOT EXISTS nota_revision text;

CREATE OR REPLACE FUNCTION public.fn_admin_resolver_solicitud_cambio(
  p_solicitud_id uuid,
  p_decision text,
  p_revisado_por uuid DEFAULT NULL,
  p_nota_revision text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req record;
  v_decision text := lower(coalesce(p_decision, ''));
  v_nombre text;
  v_logo text;
  v_lat double precision;
  v_lon double precision;
BEGIN
  IF v_decision NOT IN ('aprobada', 'rechazada', 'cancelada') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Decision invalida. Usa: aprobada, rechazada o cancelada.';
  END IF;

  SELECT *
  INTO v_req
  FROM public.solicitudes_cambio_comercio
  WHERE id = p_solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'No se encontro la solicitud.';
  END IF;

  IF v_req.estado <> 'pendiente' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'La solicitud ya fue procesada.';
  END IF;

  IF v_decision = 'aprobada' THEN
    PERFORM set_config('app.findixi_allow_protected_change', 'on', true);

    IF v_req.campo = 'nombre' THEN
      v_nombre := nullif(trim(v_req.valor_solicitado->>'nombre'), '');
      IF v_nombre IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Solicitud invalida: nombre requerido.';
      END IF;

      UPDATE public."Comercios"
      SET nombre = v_nombre
      WHERE id = v_req."idComercio";

    ELSIF v_req.campo = 'logo' THEN
      v_logo := nullif(trim(v_req.valor_solicitado->>'logo'), '');
      IF v_logo IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Solicitud invalida: logo requerido.';
      END IF;

      UPDATE public."Comercios"
      SET logo = v_logo
      WHERE id = v_req."idComercio";

    ELSIF v_req.campo = 'coordenadas' THEN
      v_lat := nullif(v_req.valor_solicitado->>'latitud', '')::double precision;
      v_lon := nullif(v_req.valor_solicitado->>'longitud', '')::double precision;

      IF v_lat IS NULL OR v_lon IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Solicitud invalida: latitud/longitud requeridas.';
      END IF;
      IF v_lat < -90 OR v_lat > 90 OR v_lon < -180 OR v_lon > 180 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Solicitud invalida: coordenadas fuera de rango.';
      END IF;

      UPDATE public."Comercios"
      SET
        latitud = v_lat,
        longitud = v_lon
      WHERE id = v_req."idComercio";

    ELSE
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Campo de solicitud no soportado.';
    END IF;
  END IF;

  UPDATE public.solicitudes_cambio_comercio
  SET
    estado = v_decision,
    revisado_por = p_revisado_por,
    revisado_en = now(),
    nota_revision = p_nota_revision
  WHERE id = p_solicitud_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_solicitud_id,
    'decision', v_decision,
    'idComercio', v_req."idComercio",
    'campo', v_req.campo
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_admin_resolver_disputa_comercio(
  p_disputa_id uuid,
  p_decision text,
  p_revisado_por uuid DEFAULT NULL,
  p_nota_revision text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_disputa record;
  v_decision text := lower(coalesce(p_decision, ''));
BEGIN
  IF v_decision NOT IN ('aprobada', 'rechazada', 'cancelada') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Decision invalida. Usa: aprobada, rechazada o cancelada.';
  END IF;

  SELECT *
  INTO v_disputa
  FROM public.disputas_comercio
  WHERE id = p_disputa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'No se encontro la disputa.';
  END IF;

  IF coalesce(v_disputa.estado, 'pendiente') <> 'pendiente' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'La disputa ya fue procesada.';
  END IF;

  IF v_decision = 'aprobada' THEN
    PERFORM set_config('app.findixi_allow_protected_change', 'on', true);

    UPDATE public."Comercios"
    SET
      estado_propiedad = 'verificado',
      estado_verificacion = 'otp_verificado',
      owner_user_id = coalesce(v_disputa.user_id, owner_user_id),
      propietario_verificado = true,
      bloqueo_datos_criticos = false
    WHERE id = v_disputa."idComercio";
  END IF;

  UPDATE public.disputas_comercio
  SET
    estado = v_decision,
    revisado_por = p_revisado_por,
    revisado_en = now(),
    nota_revision = p_nota_revision,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'reviewed_at', now(),
      'reviewed_by', p_revisado_por,
      'decision', v_decision
    )
  WHERE id = p_disputa_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_disputa_id,
    'decision', v_decision,
    'idComercio', v_disputa."idComercio"
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_resolver_solicitud_cambio(uuid, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_admin_resolver_disputa_comercio(uuid, text, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fn_admin_resolver_solicitud_cambio(uuid, text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_admin_resolver_disputa_comercio(uuid, text, uuid, text) TO authenticated, service_role;

COMMIT;
