BEGIN;

ALTER TABLE public."ComercioStaffServicios"
  DROP CONSTRAINT IF EXISTS comercio_staff_servicios_precio_nonnegative;

DO $$
DECLARE
  v_data_type text;
BEGIN
  SELECT c.data_type
  INTO v_data_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'ComercioStaffServicios'
    AND c.column_name = 'precio'
  LIMIT 1;

  IF v_data_type IS NULL THEN
    ALTER TABLE public."ComercioStaffServicios"
      ADD COLUMN precio text NOT NULL DEFAULT '';
  ELSIF v_data_type <> 'text' THEN
    ALTER TABLE public."ComercioStaffServicios"
      ALTER COLUMN precio TYPE text USING COALESCE(precio::text, '');
    ALTER TABLE public."ComercioStaffServicios"
      ALTER COLUMN precio SET DEFAULT '';
    UPDATE public."ComercioStaffServicios"
      SET precio = ''
      WHERE precio IS NULL;
    ALTER TABLE public."ComercioStaffServicios"
      ALTER COLUMN precio SET NOT NULL;
  ELSE
    ALTER TABLE public."ComercioStaffServicios"
      ALTER COLUMN precio SET DEFAULT '';
    UPDATE public."ComercioStaffServicios"
      SET precio = ''
      WHERE precio IS NULL;
    ALTER TABLE public."ComercioStaffServicios"
      ALTER COLUMN precio SET NOT NULL;
  END IF;
END;
$$;

COMMENT ON COLUMN public."ComercioStaffServicios".precio
  IS 'Precio libre en texto. Ej: "$25" o "$20 - $35".';

COMMIT;
