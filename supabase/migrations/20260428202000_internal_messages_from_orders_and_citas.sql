BEGIN;

CREATE OR REPLACE FUNCTION public.fn_normalize_phone(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.fn_queue_internal_message_from_cita_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_event_key text;
  v_message text;
  v_status text;
  v_canal text;
  v_comercio_id bigint;
  v_comercio_nombre text;
  v_fecha date;
  v_hora time;
  v_destino_email text;
BEGIN
  IF lower(coalesce(NEW.destinatario, '')) <> 'cliente' THEN
    RETURN NEW;
  END IF;

  v_canal := lower(coalesce(NEW.canal, ''));
  IF v_canal = 'email' THEN
    RETURN NEW;
  END IF;

  SELECT
    cc.id_usuario,
    cc.id_comercio,
    c.nombre,
    cc.fecha_cita,
    cc.hora_inicio,
    nullif(trim(coalesce(cc.cliente_email, '')), '')
  INTO
    v_user_id,
    v_comercio_id,
    v_comercio_nombre,
    v_fecha,
    v_hora,
    v_destino_email
  FROM public."ComercioCitas" cc
  LEFT JOIN public."Comercios" c ON c.id = cc.id_comercio
  WHERE cc.id = NEW.id_cita
  LIMIT 1;

  IF v_user_id IS NULL AND v_destino_email IS NOT NULL THEN
    SELECT u.id
    INTO v_user_id
    FROM public.usuarios u
    WHERE lower(coalesce(u.email, '')) = lower(v_destino_email)
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    SELECT u.id
    INTO v_user_id
    FROM public.usuarios u
    WHERE public.fn_normalize_phone(u.telefono) <> ''
      AND public.fn_normalize_phone(u.telefono) = public.fn_normalize_phone(NEW.destino)
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_event_key := coalesce(nullif(trim(coalesce(NEW.payload->>'event_key', '')), ''), format('cita-notif:%s', NEW.id));
  v_message := coalesce(
    nullif(trim(coalesce(NEW.payload->>'message', '')), ''),
    format(
      'Tienes una actualización de cita en %s para %s a las %s.',
      coalesce(v_comercio_nombre, 'el comercio'),
      coalesce(to_char(v_fecha, 'YYYY-MM-DD'), 'fecha pendiente'),
      coalesce(to_char(v_hora, 'HH24:MI'), '--:--')
    )
  );
  v_status := coalesce(nullif(trim(coalesce(NEW.payload->>'status', '')), ''), 'pendiente');

  INSERT INTO public."Mensajes" (
    id_comercio,
    creado_por,
    destino_usuario,
    destino_email,
    tipo,
    payload,
    estado
  )
  SELECT
    v_comercio_id,
    v_user_id,
    v_user_id,
    v_destino_email,
    'notificacion_cita',
    coalesce(NEW.payload, '{}'::jsonb) || jsonb_build_object(
      'event_key', v_event_key,
      'message', v_message,
      'status', v_status,
      'source_table', 'ComercioCitasNotificaciones',
      'source_id', NEW.id,
      'id_cita', NEW.id_cita,
      'canal', v_canal
    ),
    'pendiente'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public."Mensajes" m
    WHERE m.tipo = 'notificacion_cita'
      AND m.destino_usuario = v_user_id
      AND (m.payload->>'event_key') = v_event_key
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_internal_message_from_cita_notif ON public."ComercioCitasNotificaciones";
CREATE TRIGGER trg_queue_internal_message_from_cita_notif
AFTER INSERT ON public."ComercioCitasNotificaciones"
FOR EACH ROW
EXECUTE FUNCTION public.fn_queue_internal_message_from_cita_notif();

CREATE OR REPLACE FUNCTION public.fn_queue_internal_message_from_order_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_destino_email text;
  v_comercio_nombre text;
  v_event_key text;
  v_message text;
  v_status text;
  v_canal text;
BEGIN
  IF lower(coalesce(NEW.destinatario, '')) <> 'cliente' THEN
    RETURN NEW;
  END IF;

  SELECT
    o.customer_user_id,
    nullif(trim(coalesce(o.customer_email, '')), ''),
    c.nombre
  INTO
    v_user_id,
    v_destino_email,
    v_comercio_nombre
  FROM public.ordenes o
  LEFT JOIN public."Comercios" c ON c.id = o.idcomercio
  WHERE o.id = NEW.id_orden
  LIMIT 1;

  IF v_user_id IS NULL AND v_destino_email IS NOT NULL THEN
    SELECT u.id
    INTO v_user_id
    FROM public.usuarios u
    WHERE lower(coalesce(u.email, '')) = lower(v_destino_email)
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    SELECT u.id
    INTO v_user_id
    FROM public.usuarios u
    WHERE public.fn_normalize_phone(u.telefono) <> ''
      AND public.fn_normalize_phone(u.telefono) = public.fn_normalize_phone(NEW.destino)
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_canal := lower(coalesce(NEW.canal, ''));
  v_event_key := coalesce(nullif(trim(coalesce(NEW.payload->>'event_key', '')), ''), format('order-notif:%s', NEW.id));
  v_message := coalesce(
    nullif(trim(coalesce(NEW.message, '')), ''),
    nullif(trim(coalesce(NEW.payload->>'message', '')), ''),
    format('Tu orden #%s en %s fue actualizada.', NEW.id_orden, coalesce(v_comercio_nombre, 'el comercio'))
  );
  v_status := coalesce(nullif(trim(coalesce(NEW.payload->>'status', '')), ''), 'pendiente');

  INSERT INTO public."Mensajes" (
    id_comercio,
    creado_por,
    destino_usuario,
    destino_email,
    tipo,
    payload,
    estado
  )
  SELECT
    NEW.id_comercio,
    v_user_id,
    v_user_id,
    v_destino_email,
    'notificacion_orden',
    coalesce(NEW.payload, '{}'::jsonb) || jsonb_build_object(
      'event_key', v_event_key,
      'message', v_message,
      'status', v_status,
      'source_table', 'ordenes_notificaciones',
      'source_id', NEW.id,
      'id_orden', NEW.id_orden,
      'canal', v_canal
    ),
    'pendiente'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public."Mensajes" m
    WHERE m.tipo = 'notificacion_orden'
      AND m.destino_usuario = v_user_id
      AND (m.payload->>'event_key') = v_event_key
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_internal_message_from_order_notif ON public.ordenes_notificaciones;
CREATE TRIGGER trg_queue_internal_message_from_order_notif
AFTER INSERT ON public.ordenes_notificaciones
FOR EACH ROW
EXECUTE FUNCTION public.fn_queue_internal_message_from_order_notif();

COMMIT;
