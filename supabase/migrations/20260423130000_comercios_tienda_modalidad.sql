BEGIN;

ALTER TABLE public."Comercios"
  ADD COLUMN IF NOT EXISTS "tiendaFisica" boolean,
  ADD COLUMN IF NOT EXISTS "tiendaOnline" boolean;

ALTER TABLE public."Comercios"
  ALTER COLUMN "tiendaFisica" SET DEFAULT true,
  ALTER COLUMN "tiendaOnline" SET DEFAULT false;

UPDATE public."Comercios"
SET
  "tiendaFisica" = COALESCE("tiendaFisica", true),
  "tiendaOnline" = COALESCE("tiendaOnline", false)
WHERE
  "tiendaFisica" IS NULL
  OR "tiendaOnline" IS NULL;

COMMIT;
