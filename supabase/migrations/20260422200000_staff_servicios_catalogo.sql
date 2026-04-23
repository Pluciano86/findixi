BEGIN;

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public."ComercioStaffServicios" (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_staff bigint NOT NULL REFERENCES public."ComercioStaff"(id) ON DELETE CASCADE,
  nombre text NOT NULL CHECK (char_length(btrim(nombre)) >= 2),
  descripcion text,
  duracion_min integer NOT NULL DEFAULT 60 CHECK (duracion_min BETWEEN 15 AND 480),
  orden integer NOT NULL DEFAULT 100,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);

CREATE INDEX IF NOT EXISTS comercio_staff_servicios_id_staff_idx
  ON public."ComercioStaffServicios" (id_staff, activo, orden, id);

DROP TRIGGER IF EXISTS trg_comercio_staff_servicios_set_updated_at ON public."ComercioStaffServicios";
CREATE TRIGGER trg_comercio_staff_servicios_set_updated_at
BEFORE UPDATE ON public."ComercioStaffServicios"
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public."ComercioStaffServicios" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comercio_staff_servicios_select_public_active ON public."ComercioStaffServicios";
CREATE POLICY comercio_staff_servicios_select_public_active
ON public."ComercioStaffServicios"
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

DROP POLICY IF EXISTS comercio_staff_servicios_select_owner ON public."ComercioStaffServicios";
CREATE POLICY comercio_staff_servicios_select_owner
ON public."ComercioStaffServicios"
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

DROP POLICY IF EXISTS comercio_staff_servicios_insert_owner ON public."ComercioStaffServicios";
CREATE POLICY comercio_staff_servicios_insert_owner
ON public."ComercioStaffServicios"
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

DROP POLICY IF EXISTS comercio_staff_servicios_update_owner ON public."ComercioStaffServicios";
CREATE POLICY comercio_staff_servicios_update_owner
ON public."ComercioStaffServicios"
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

DROP POLICY IF EXISTS comercio_staff_servicios_delete_owner ON public."ComercioStaffServicios";
CREATE POLICY comercio_staff_servicios_delete_owner
ON public."ComercioStaffServicios"
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

COMMIT;
