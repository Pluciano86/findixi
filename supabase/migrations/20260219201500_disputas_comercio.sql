BEGIN;

CREATE TABLE IF NOT EXISTS public.disputas_comercio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idComercio" bigint NOT NULL REFERENCES public."Comercios"(id) ON DELETE CASCADE,
  google_place_id text,
  nombre_comercio text,
  user_id uuid,
  contacto_nombre text NOT NULL,
  contacto_email text NOT NULL,
  contacto_telefono text NOT NULL,
  mensaje text,
  estado text NOT NULL DEFAULT 'pendiente',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS disputas_comercio_comercio_idx
  ON public.disputas_comercio ("idComercio", created_at DESC);

CREATE INDEX IF NOT EXISTS disputas_comercio_estado_idx
  ON public.disputas_comercio (estado, created_at DESC);

COMMIT;
