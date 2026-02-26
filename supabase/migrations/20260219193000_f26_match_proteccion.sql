BEGIN;

ALTER TABLE public."Comercios"
  ADD COLUMN IF NOT EXISTS nombre_normalizado text,
  ADD COLUMN IF NOT EXISTS bandera_posible_duplicado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_place_id_posible_match text,
  ADD COLUMN IF NOT EXISTS posible_match_strength text,
  ADD COLUMN IF NOT EXISTS posible_match_distancia_m integer,
  ADD COLUMN IF NOT EXISTS posible_match_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS comercios_nombre_normalizado_idx
  ON public."Comercios" (nombre_normalizado);

CREATE INDEX IF NOT EXISTS comercios_google_place_id_posible_match_idx
  ON public."Comercios" (google_place_id_posible_match);

COMMIT;
