BEGIN;

CREATE OR REPLACE FUNCTION public.fn_queue_comercio_cita_notificaciones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comercio_nombre text;
  v_comercio_telefono text;
  v_comercio_whatsapp text;
  v_comercio_email text;
  v_fecha_label text;
  v_hora_label text;
  v_msg_cliente text;
  v_msg_comercio text;
  v_destino_comercio text;
BEGIN
  SELECT c.nombre, c.telefono, c.whatsapp, c.email
  INTO v_comercio_nombre, v_comercio_telefono, v_comercio_whatsapp, v_comercio_email
  FROM public."Comercios" c
  WHERE c.id = NEW.id_comercio
  LIMIT 1;

  v_fecha_label := to_char(NEW.fecha_cita, 'YYYY-MM-DD');
  v_hora_label := to_char(NEW.hora_inicio, 'HH24:MI');

  v_msg_cliente := format(
    'Cita recibida en %s para %s a las %s. Te notificaremos cuando el comercio la confirme.',
    coalesce(v_comercio_nombre, 'el comercio'),
    v_fecha_label,
    v_hora_label
  );

  v_msg_comercio := format(
    'Nueva cita pendiente para %s (%s) el %s a las %s.',
    NEW.cliente_nombre,
    NEW.cliente_telefono,
    v_fecha_label,
    v_hora_label
  );

  IF nullif(trim(coalesce(NEW.cliente_telefono, '')), '') IS NOT NULL THEN
    INSERT INTO public."ComercioCitasNotificaciones" (id_cita, destinatario, canal, destino, payload)
    VALUES (
      NEW.id,
      'cliente',
      'whatsapp',
      NEW.cliente_telefono,
      jsonb_build_object(
        'event_key', 'cita-created',
        'message', v_msg_cliente,
        'comercio', coalesce(v_comercio_nombre, ''),
        'fecha', NEW.fecha_cita,
        'hora', NEW.hora_inicio
      )
    );
  END IF;

  v_destino_comercio := nullif(trim(coalesce(v_comercio_whatsapp, '')), '');
  IF v_destino_comercio IS NULL THEN
    v_destino_comercio := nullif(trim(coalesce(v_comercio_telefono, '')), '');
  END IF;

  IF v_destino_comercio IS NOT NULL THEN
    INSERT INTO public."ComercioCitasNotificaciones" (id_cita, destinatario, canal, destino, payload)
    VALUES (
      NEW.id,
      'comercio',
      'whatsapp',
      v_destino_comercio,
      jsonb_build_object(
        'event_key', 'cita-created-comercio',
        'message', v_msg_comercio,
        'cliente', NEW.cliente_nombre,
        'telefono', NEW.cliente_telefono,
        'fecha', NEW.fecha_cita,
        'hora', NEW.hora_inicio
      )
    );
  END IF;

  IF nullif(trim(coalesce(v_comercio_email, '')), '') IS NOT NULL THEN
    INSERT INTO public."ComercioCitasNotificaciones" (id_cita, destinatario, canal, destino, payload)
    VALUES (
      NEW.id,
      'comercio',
      'email',
      v_comercio_email,
      jsonb_build_object(
        'subject', 'Nueva cita pendiente',
        'message', v_msg_comercio,
        'cliente', NEW.cliente_nombre,
        'telefono', NEW.cliente_telefono,
        'fecha', NEW.fecha_cita,
        'hora', NEW.hora_inicio
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
