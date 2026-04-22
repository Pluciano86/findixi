BEGIN;

CREATE OR REPLACE FUNCTION public.fn_user_can_manage_comercio(p_id_comercio bigint)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public."UsuarioComercios" uc
        WHERE uc."idComercio" = p_id_comercio
          AND uc."idUsuario" = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public."Comercios" c
        WHERE c.id = p_id_comercio
          AND c.owner_user_id = auth.uid()
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public."ComercioStaff" (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_comercio bigint NOT NULL REFERENCES public."Comercios"(id) ON DELETE CASCADE,
  nombre text NOT NULL CHECK (char_length(btrim(nombre)) >= 2),
  profesion text NOT NULL DEFAULT '',
  foto_url text,
  telefono text,
  email text,
  facebook text,
  instagram text,
  whatsapp text,
  biografia text,
  agenda_config jsonb NOT NULL DEFAULT jsonb_build_object(
    'timezone', 'America/Puerto_Rico',
    'slot_minutes', 60,
    'buffer_minutes', 0,
    'dias', jsonb_build_object(
      '1', jsonb_build_array(jsonb_build_object('inicio', '09:00', 'fin', '17:00')),
      '2', jsonb_build_array(jsonb_build_object('inicio', '09:00', 'fin', '17:00')),
      '3', jsonb_build_array(jsonb_build_object('inicio', '09:00', 'fin', '17:00')),
      '4', jsonb_build_array(jsonb_build_object('inicio', '09:00', 'fin', '17:00')),
      '5', jsonb_build_array(jsonb_build_object('inicio', '09:00', 'fin', '17:00')),
      '6', jsonb_build_array(jsonb_build_object('inicio', '09:00', 'fin', '14:00'))
    )
  ),
  orden integer NOT NULL DEFAULT 100,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public."ComercioStaffTrabajos" (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_staff bigint NOT NULL REFERENCES public."ComercioStaff"(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  titulo text,
  descripcion text,
  orden integer NOT NULL DEFAULT 100,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public."ComercioCitas" (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_comercio bigint NOT NULL REFERENCES public."Comercios"(id) ON DELETE CASCADE,
  id_staff bigint NOT NULL REFERENCES public."ComercioStaff"(id) ON DELETE CASCADE,
  id_usuario uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cliente_nombre text NOT NULL CHECK (char_length(btrim(cliente_nombre)) >= 2),
  cliente_telefono text NOT NULL,
  cliente_email text,
  servicio text,
  notas text,
  fecha_cita date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Puerto_Rico',
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'completada', 'rechazada')),
  canal_origen text NOT NULL DEFAULT 'web_perfil',
  recordatorio_minutos integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CHECK (hora_fin > hora_inicio),
  CHECK (recordatorio_minutos BETWEEN 5 AND 10080)
);

CREATE TABLE IF NOT EXISTS public."ComercioCitasNotificaciones" (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cita bigint NOT NULL REFERENCES public."ComercioCitas"(id) ON DELETE CASCADE,
  destinatario text NOT NULL CHECK (destinatario IN ('cliente', 'comercio')),
  canal text NOT NULL CHECK (canal IN ('sms', 'email', 'whatsapp', 'interna')),
  destino text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviada', 'error')),
  error_text text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comercio_staff_id_comercio_idx
  ON public."ComercioStaff" (id_comercio, activo, orden, id);

CREATE INDEX IF NOT EXISTS comercio_staff_trabajos_id_staff_idx
  ON public."ComercioStaffTrabajos" (id_staff, activo, orden, id);

CREATE INDEX IF NOT EXISTS comercio_citas_by_staff_date_idx
  ON public."ComercioCitas" (id_staff, fecha_cita, hora_inicio);

CREATE INDEX IF NOT EXISTS comercio_citas_by_comercio_date_idx
  ON public."ComercioCitas" (id_comercio, fecha_cita, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS comercio_citas_staff_slot_unique
  ON public."ComercioCitas" (id_staff, fecha_cita, hora_inicio)
  WHERE estado IN ('pendiente', 'confirmada');

CREATE INDEX IF NOT EXISTS comercio_citas_notificaciones_estado_idx
  ON public."ComercioCitasNotificaciones" (estado, scheduled_at);

DROP TRIGGER IF EXISTS trg_comercio_staff_set_updated_at ON public."ComercioStaff";
CREATE TRIGGER trg_comercio_staff_set_updated_at
BEFORE UPDATE ON public."ComercioStaff"
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_comercio_staff_trabajos_set_updated_at ON public."ComercioStaffTrabajos";
CREATE TRIGGER trg_comercio_staff_trabajos_set_updated_at
BEFORE UPDATE ON public."ComercioStaffTrabajos"
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_comercio_citas_set_updated_at ON public."ComercioCitas";
CREATE TRIGGER trg_comercio_citas_set_updated_at
BEFORE UPDATE ON public."ComercioCitas"
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_updated_at();

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
      'sms',
      NEW.cliente_telefono,
      jsonb_build_object(
        'message', v_msg_cliente,
        'comercio', coalesce(v_comercio_nombre, ''),
        'fecha', NEW.fecha_cita,
        'hora', NEW.hora_inicio
      )
    );
  END IF;

  IF nullif(trim(coalesce(NEW.cliente_email, '')), '') IS NOT NULL THEN
    INSERT INTO public."ComercioCitasNotificaciones" (id_cita, destinatario, canal, destino, payload)
    VALUES (
      NEW.id,
      'cliente',
      'email',
      NEW.cliente_email,
      jsonb_build_object(
        'subject', 'Cita recibida',
        'message', v_msg_cliente,
        'comercio', coalesce(v_comercio_nombre, ''),
        'fecha', NEW.fecha_cita,
        'hora', NEW.hora_inicio
      )
    );
  END IF;

  IF nullif(trim(coalesce(v_comercio_whatsapp, '')), '') IS NOT NULL THEN
    INSERT INTO public."ComercioCitasNotificaciones" (id_cita, destinatario, canal, destino, payload)
    VALUES (
      NEW.id,
      'comercio',
      'whatsapp',
      v_comercio_whatsapp,
      jsonb_build_object(
        'message', v_msg_comercio,
        'cliente', NEW.cliente_nombre,
        'telefono', NEW.cliente_telefono,
        'fecha', NEW.fecha_cita,
        'hora', NEW.hora_inicio
      )
    );
  ELSIF nullif(trim(coalesce(v_comercio_telefono, '')), '') IS NOT NULL THEN
    INSERT INTO public."ComercioCitasNotificaciones" (id_cita, destinatario, canal, destino, payload)
    VALUES (
      NEW.id,
      'comercio',
      'sms',
      v_comercio_telefono,
      jsonb_build_object(
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

DROP TRIGGER IF EXISTS trg_queue_comercio_cita_notificaciones ON public."ComercioCitas";
CREATE TRIGGER trg_queue_comercio_cita_notificaciones
AFTER INSERT ON public."ComercioCitas"
FOR EACH ROW
EXECUTE FUNCTION public.fn_queue_comercio_cita_notificaciones();

ALTER TABLE public."ComercioStaff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComercioStaffTrabajos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComercioCitas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComercioCitasNotificaciones" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comercio_staff_select_public_active ON public."ComercioStaff";
CREATE POLICY comercio_staff_select_public_active
ON public."ComercioStaff"
FOR SELECT
TO anon, authenticated
USING (activo = true);

DROP POLICY IF EXISTS comercio_staff_select_owner ON public."ComercioStaff";
CREATE POLICY comercio_staff_select_owner
ON public."ComercioStaff"
FOR SELECT
TO authenticated
USING (public.fn_user_can_manage_comercio(id_comercio));

DROP POLICY IF EXISTS comercio_staff_insert_owner ON public."ComercioStaff";
CREATE POLICY comercio_staff_insert_owner
ON public."ComercioStaff"
FOR INSERT
TO authenticated
WITH CHECK (public.fn_user_can_manage_comercio(id_comercio));

DROP POLICY IF EXISTS comercio_staff_update_owner ON public."ComercioStaff";
CREATE POLICY comercio_staff_update_owner
ON public."ComercioStaff"
FOR UPDATE
TO authenticated
USING (public.fn_user_can_manage_comercio(id_comercio))
WITH CHECK (public.fn_user_can_manage_comercio(id_comercio));

DROP POLICY IF EXISTS comercio_staff_delete_owner ON public."ComercioStaff";
CREATE POLICY comercio_staff_delete_owner
ON public."ComercioStaff"
FOR DELETE
TO authenticated
USING (public.fn_user_can_manage_comercio(id_comercio));

DROP POLICY IF EXISTS comercio_staff_trabajos_select_public_active ON public."ComercioStaffTrabajos";
CREATE POLICY comercio_staff_trabajos_select_public_active
ON public."ComercioStaffTrabajos"
FOR SELECT
TO anon, authenticated
USING (
  activo = true
  AND EXISTS (
    SELECT 1
    FROM public."ComercioStaff" s
    WHERE s.id = id_staff
      AND s.activo = true
  )
);

DROP POLICY IF EXISTS comercio_staff_trabajos_select_owner ON public."ComercioStaffTrabajos";
CREATE POLICY comercio_staff_trabajos_select_owner
ON public."ComercioStaffTrabajos"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public."ComercioStaff" s
    WHERE s.id = id_staff
      AND public.fn_user_can_manage_comercio(s.id_comercio)
  )
);

DROP POLICY IF EXISTS comercio_staff_trabajos_insert_owner ON public."ComercioStaffTrabajos";
CREATE POLICY comercio_staff_trabajos_insert_owner
ON public."ComercioStaffTrabajos"
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public."ComercioStaff" s
    WHERE s.id = id_staff
      AND public.fn_user_can_manage_comercio(s.id_comercio)
  )
);

DROP POLICY IF EXISTS comercio_staff_trabajos_update_owner ON public."ComercioStaffTrabajos";
CREATE POLICY comercio_staff_trabajos_update_owner
ON public."ComercioStaffTrabajos"
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public."ComercioStaff" s
    WHERE s.id = id_staff
      AND public.fn_user_can_manage_comercio(s.id_comercio)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public."ComercioStaff" s
    WHERE s.id = id_staff
      AND public.fn_user_can_manage_comercio(s.id_comercio)
  )
);

DROP POLICY IF EXISTS comercio_staff_trabajos_delete_owner ON public."ComercioStaffTrabajos";
CREATE POLICY comercio_staff_trabajos_delete_owner
ON public."ComercioStaffTrabajos"
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public."ComercioStaff" s
    WHERE s.id = id_staff
      AND public.fn_user_can_manage_comercio(s.id_comercio)
  )
);

DROP POLICY IF EXISTS comercio_citas_select_owner_or_cliente ON public."ComercioCitas";
CREATE POLICY comercio_citas_select_owner_or_cliente
ON public."ComercioCitas"
FOR SELECT
TO authenticated
USING (
  public.fn_user_can_manage_comercio(id_comercio)
  OR id_usuario = auth.uid()
);

DROP POLICY IF EXISTS comercio_citas_insert_cliente_auth ON public."ComercioCitas";
CREATE POLICY comercio_citas_insert_cliente_auth
ON public."ComercioCitas"
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND id_usuario = auth.uid()
  AND fecha_cita >= CURRENT_DATE
  AND EXISTS (
    SELECT 1
    FROM public."ComercioStaff" s
    WHERE s.id = id_staff
      AND s.id_comercio = id_comercio
      AND s.activo = true
  )
);

DROP POLICY IF EXISTS comercio_citas_insert_owner ON public."ComercioCitas";
CREATE POLICY comercio_citas_insert_owner
ON public."ComercioCitas"
FOR INSERT
TO authenticated
WITH CHECK (
  public.fn_user_can_manage_comercio(id_comercio)
  AND fecha_cita >= CURRENT_DATE
  AND EXISTS (
    SELECT 1
    FROM public."ComercioStaff" s
    WHERE s.id = id_staff
      AND s.id_comercio = id_comercio
  )
);

DROP POLICY IF EXISTS comercio_citas_update_owner ON public."ComercioCitas";
CREATE POLICY comercio_citas_update_owner
ON public."ComercioCitas"
FOR UPDATE
TO authenticated
USING (public.fn_user_can_manage_comercio(id_comercio))
WITH CHECK (public.fn_user_can_manage_comercio(id_comercio));

DROP POLICY IF EXISTS comercio_citas_delete_owner ON public."ComercioCitas";
CREATE POLICY comercio_citas_delete_owner
ON public."ComercioCitas"
FOR DELETE
TO authenticated
USING (public.fn_user_can_manage_comercio(id_comercio));

DROP POLICY IF EXISTS comercio_citas_notif_select_owner_or_cliente ON public."ComercioCitasNotificaciones";
CREATE POLICY comercio_citas_notif_select_owner_or_cliente
ON public."ComercioCitasNotificaciones"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public."ComercioCitas" cc
    WHERE cc.id = id_cita
      AND (
        cc.id_usuario = auth.uid()
        OR public.fn_user_can_manage_comercio(cc.id_comercio)
      )
  )
);

DROP POLICY IF EXISTS comercio_citas_notif_insert_related ON public."ComercioCitasNotificaciones";
CREATE POLICY comercio_citas_notif_insert_related
ON public."ComercioCitasNotificaciones"
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public."ComercioCitas" cc
    WHERE cc.id = id_cita
      AND (
        cc.id_usuario = auth.uid()
        OR public.fn_user_can_manage_comercio(cc.id_comercio)
      )
  )
);

DROP POLICY IF EXISTS comercio_citas_notif_insert_service_role ON public."ComercioCitasNotificaciones";
CREATE POLICY comercio_citas_notif_insert_service_role
ON public."ComercioCitasNotificaciones"
FOR INSERT
TO service_role
WITH CHECK (true);

COMMIT;
