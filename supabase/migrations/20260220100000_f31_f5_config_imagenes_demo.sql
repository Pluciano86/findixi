BEGIN;

ALTER TABLE public."Comercios"
  ADD COLUMN IF NOT EXISTS logo_url_original text,
  ADD COLUMN IF NOT EXISTS logo_url_procesado text,
  ADD COLUMN IF NOT EXISTS logo_estado text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS logo_aprobado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS logo_upgrade_usado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS logo_upgrade_modo text,
  ADD COLUMN IF NOT EXISTS logo_upgrade_precio numeric(10,2) NOT NULL DEFAULT 25.00,
  ADD COLUMN IF NOT EXISTS logo_upgrade_aprobado_por_usuario boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS logo_upgrade_fecha timestamptz,
  ADD COLUMN IF NOT EXISTS logo_revision_notas text,
  ADD COLUMN IF NOT EXISTS portada_url_original text,
  ADD COLUMN IF NOT EXISTS portada_url_procesado text,
  ADD COLUMN IF NOT EXISTS portada_estado text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS portada_aprobada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pago_estado_demo text NOT NULL DEFAULT 'demo_pendiente';

UPDATE public."Comercios"
SET
  logo_url_original = COALESCE(logo_url_original, logo),
  logo_url_procesado = COALESCE(logo_url_procesado, logo),
  portada_url_original = COALESCE(portada_url_original, portada),
  portada_url_procesado = COALESCE(portada_url_procesado, portada)
WHERE
  logo IS NOT NULL
  OR portada IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comercios_logo_estado_chk'
      AND conrelid = 'public."Comercios"'::regclass
  ) THEN
    ALTER TABLE public."Comercios"
      ADD CONSTRAINT comercios_logo_estado_chk
      CHECK (
        logo_estado IN ('pendiente', 'aprobado', 'requiere_accion', 'en_upgrade', 'upgrade_listo')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comercios_portada_estado_chk'
      AND conrelid = 'public."Comercios"'::regclass
  ) THEN
    ALTER TABLE public."Comercios"
      ADD CONSTRAINT comercios_portada_estado_chk
      CHECK (
        portada_estado IN ('pendiente', 'aprobado', 'requiere_accion', 'en_upgrade', 'upgrade_listo')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comercios_logo_upgrade_modo_chk'
      AND conrelid = 'public."Comercios"'::regclass
  ) THEN
    ALTER TABLE public."Comercios"
      ADD CONSTRAINT comercios_logo_upgrade_modo_chk
      CHECK (
        logo_upgrade_modo IS NULL
        OR logo_upgrade_modo IN ('incluido', 'pago_basic', 'demo')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comercios_pago_estado_demo_chk'
      AND conrelid = 'public."Comercios"'::regclass
  ) THEN
    ALTER TABLE public."Comercios"
      ADD CONSTRAINT comercios_pago_estado_demo_chk
      CHECK (
        pago_estado_demo IN ('demo_pendiente', 'demo_aprobado', 'demo_rechazado')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS comercios_logo_estado_idx
  ON public."Comercios" (logo_estado);

CREATE INDEX IF NOT EXISTS comercios_portada_estado_idx
  ON public."Comercios" (portada_estado);

CREATE INDEX IF NOT EXISTS comercios_logo_upgrade_modo_idx
  ON public."Comercios" (logo_upgrade_modo);

COMMIT;
