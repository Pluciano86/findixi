BEGIN;

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS telefono_verificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telefono_verificado_at timestamptz;

CREATE TABLE IF NOT EXISTS public.user_phone_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destination_phone text NOT NULL,
  hashed_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts_left integer NOT NULL DEFAULT 5 CHECK (attempts_left >= 0),
  cooldown_until timestamptz NOT NULL,
  channel_used text CHECK (channel_used IN ('sms', 'voice', 'whatsapp')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'blocked')),
  requester_ip inet,
  provider text,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_phone_otp_challenges_user_created_idx
  ON public.user_phone_otp_challenges (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_phone_otp_challenges_status_idx
  ON public.user_phone_otp_challenges (status, expires_at DESC);

ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS customer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.ordenes_notificaciones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_orden bigint NOT NULL REFERENCES public.ordenes(id) ON DELETE CASCADE,
  id_comercio bigint NOT NULL REFERENCES public."Comercios"(id) ON DELETE CASCADE,
  destinatario text NOT NULL CHECK (destinatario IN ('cliente', 'comercio')),
  canal text NOT NULL CHECK (canal IN ('sms', 'whatsapp', 'voice', 'email')),
  destino text NOT NULL,
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviada', 'error')),
  error_text text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  provider text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ordenes_notificaciones_estado_idx
  ON public.ordenes_notificaciones (estado, scheduled_at);

CREATE INDEX IF NOT EXISTS ordenes_notificaciones_orden_idx
  ON public.ordenes_notificaciones (id_orden, created_at DESC);

CREATE OR REPLACE FUNCTION public.fn_order_status_human(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(p_status, ''))
    WHEN 'pending' THEN 'pendiente de pago'
    WHEN 'paid' THEN 'pagada'
    WHEN 'sent' THEN 'enviada'
    WHEN 'confirmed' THEN 'confirmada'
    WHEN 'preparing' THEN 'en preparación'
    WHEN 'ready' THEN 'lista para recoger'
    WHEN 'delivered' THEN 'entregada'
    WHEN 'cancelled' THEN 'cancelada'
    WHEN 'canceled' THEN 'cancelada'
    ELSE coalesce(nullif(trim(p_status), ''), 'en proceso')
  END;
$$;

CREATE OR REPLACE FUNCTION public.fn_queue_orden_notificaciones()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_comercio_nombre text;
  v_destino text;
  v_event_key text;
  v_message text;
  v_status text;
BEGIN
  SELECT c.nombre INTO v_comercio_nombre
  FROM public."Comercios" c
  WHERE c.id = NEW.idcomercio
  LIMIT 1;

  v_destino := nullif(trim(coalesce(NEW.customer_phone, '')), '');
  IF v_destino IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_event_key := 'order-created';
    v_message := format(
      'Recibimos tu orden #%s en %s. Estado actual: %s.',
      NEW.id,
      coalesce(v_comercio_nombre, 'el comercio'),
      public.fn_order_status_human(NEW.status)
    );

    INSERT INTO public.ordenes_notificaciones (
      id_orden, id_comercio, destinatario, canal, destino, message, payload, scheduled_at
    )
    SELECT NEW.id, NEW.idcomercio, 'cliente', 'whatsapp', v_destino, v_message,
      jsonb_build_object('event_key', v_event_key, 'status', NEW.status), now()
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.ordenes_notificaciones n
      WHERE n.id_orden = NEW.id
        AND (n.payload->>'event_key') = v_event_key
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_status := lower(coalesce(NEW.status, ''));
    IF v_status IN ('paid', 'sent', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled', 'canceled') THEN
      v_event_key := format('order-status:%s', v_status);
      v_message := format(
        'Actualización de tu orden #%s en %s: %s.',
        NEW.id,
        coalesce(v_comercio_nombre, 'el comercio'),
        public.fn_order_status_human(NEW.status)
      );

      INSERT INTO public.ordenes_notificaciones (
        id_orden, id_comercio, destinatario, canal, destino, message, payload, scheduled_at
      )
      SELECT NEW.id, NEW.idcomercio, 'cliente', 'whatsapp', v_destino, v_message,
        jsonb_build_object('event_key', v_event_key, 'status', NEW.status), now()
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.ordenes_notificaciones n
        WHERE n.id_orden = NEW.id
          AND (n.payload->>'event_key') = v_event_key
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_orden_notificaciones ON public.ordenes;
CREATE TRIGGER trg_queue_orden_notificaciones
AFTER INSERT OR UPDATE OF status ON public.ordenes
FOR EACH ROW
EXECUTE FUNCTION public.fn_queue_orden_notificaciones();

CREATE OR REPLACE FUNCTION public.fn_queue_comercio_cita_recordatorio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_timezone text;
  v_cita_at_local timestamp;
  v_scheduled timestamptz;
  v_minutes int;
  v_comercio_nombre text;
  v_msg text;
BEGIN
  IF nullif(trim(coalesce(NEW.cliente_telefono, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;

  v_timezone := coalesce(nullif(trim(NEW.timezone), ''), 'America/Puerto_Rico');
  v_cita_at_local := NEW.fecha_cita::timestamp + NEW.hora_inicio;
  v_minutes := greatest(5, coalesce(NEW.recordatorio_minutos, 60));
  v_scheduled := (v_cita_at_local AT TIME ZONE v_timezone) - make_interval(mins => v_minutes);

  IF v_scheduled <= now() THEN
    RETURN NEW;
  END IF;

  SELECT c.nombre INTO v_comercio_nombre
  FROM public."Comercios" c
  WHERE c.id = NEW.id_comercio
  LIMIT 1;

  v_msg := format(
    'Recordatorio: tu cita en %s es el %s a las %s.',
    coalesce(v_comercio_nombre, 'el comercio'),
    to_char(NEW.fecha_cita, 'YYYY-MM-DD'),
    to_char(NEW.hora_inicio, 'HH24:MI')
  );

  INSERT INTO public."ComercioCitasNotificaciones" (
    id_cita, destinatario, canal, destino, payload, scheduled_at
  )
  SELECT
    NEW.id,
    'cliente',
    'whatsapp',
    NEW.cliente_telefono,
    jsonb_build_object(
      'event_key', 'cita-reminder',
      'message', v_msg,
      'fecha', NEW.fecha_cita,
      'hora', NEW.hora_inicio,
      'recordatorio_minutos', v_minutes
    ),
    v_scheduled
  WHERE NOT EXISTS (
    SELECT 1
    FROM public."ComercioCitasNotificaciones" n
    WHERE n.id_cita = NEW.id
      AND (n.payload->>'event_key') = 'cita-reminder'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_comercio_cita_recordatorio ON public."ComercioCitas";
CREATE TRIGGER trg_queue_comercio_cita_recordatorio
AFTER INSERT ON public."ComercioCitas"
FOR EACH ROW
EXECUTE FUNCTION public.fn_queue_comercio_cita_recordatorio();

CREATE OR REPLACE FUNCTION public.fn_queue_comercio_cita_estado_notificacion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_comercio_nombre text;
  v_event_key text;
  v_msg text;
  v_status text;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
    RETURN NEW;
  END IF;

  IF nullif(trim(coalesce(NEW.cliente_telefono, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;

  v_status := lower(coalesce(NEW.estado, ''));
  IF v_status NOT IN ('confirmada', 'cancelada', 'rechazada', 'completada') THEN
    RETURN NEW;
  END IF;

  SELECT c.nombre INTO v_comercio_nombre
  FROM public."Comercios" c
  WHERE c.id = NEW.id_comercio
  LIMIT 1;

  v_event_key := format('cita-status:%s', v_status);

  v_msg := CASE v_status
    WHEN 'confirmada' THEN format('Tu cita en %s fue confirmada para %s a las %s.', coalesce(v_comercio_nombre, 'el comercio'), to_char(NEW.fecha_cita, 'YYYY-MM-DD'), to_char(NEW.hora_inicio, 'HH24:MI'))
    WHEN 'cancelada' THEN format('Tu cita en %s fue cancelada. Si necesitas ayuda, contáctanos.', coalesce(v_comercio_nombre, 'el comercio'))
    WHEN 'rechazada' THEN format('Tu cita en %s fue rechazada. Puedes seleccionar otro horario.', coalesce(v_comercio_nombre, 'el comercio'))
    WHEN 'completada' THEN format('Tu cita en %s fue marcada como completada. ¡Gracias por visitarnos!', coalesce(v_comercio_nombre, 'el comercio'))
    ELSE format('Tu cita en %s fue actualizada.', coalesce(v_comercio_nombre, 'el comercio'))
  END;

  INSERT INTO public."ComercioCitasNotificaciones" (
    id_cita, destinatario, canal, destino, payload, scheduled_at
  )
  SELECT
    NEW.id,
    'cliente',
    'whatsapp',
    NEW.cliente_telefono,
    jsonb_build_object(
      'event_key', v_event_key,
      'status', NEW.estado,
      'message', v_msg,
      'fecha', NEW.fecha_cita,
      'hora', NEW.hora_inicio
    ),
    now()
  WHERE NOT EXISTS (
    SELECT 1
    FROM public."ComercioCitasNotificaciones" n
    WHERE n.id_cita = NEW.id
      AND (n.payload->>'event_key') = v_event_key
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_comercio_cita_estado_notificacion ON public."ComercioCitas";
CREATE TRIGGER trg_queue_comercio_cita_estado_notificacion
AFTER UPDATE OF estado ON public."ComercioCitas"
FOR EACH ROW
EXECUTE FUNCTION public.fn_queue_comercio_cita_estado_notificacion();

COMMIT;
