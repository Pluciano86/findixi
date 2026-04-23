BEGIN;

ALTER TABLE public."ComercioStaffServicios"
  ADD COLUMN IF NOT EXISTS precio numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public."ComercioStaffServicios"
  DROP CONSTRAINT IF EXISTS comercio_staff_servicios_precio_nonnegative;

ALTER TABLE public."ComercioStaffServicios"
  ADD CONSTRAINT comercio_staff_servicios_precio_nonnegative
  CHECK (precio >= 0);

COMMENT ON COLUMN public."ComercioStaffServicios".precio
  IS 'Precio del servicio en USD.';

COMMIT;
