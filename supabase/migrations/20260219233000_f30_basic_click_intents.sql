BEGIN;

CREATE TABLE IF NOT EXISTS public.basic_click_intents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "idComercio" bigint NOT NULL REFERENCES public."Comercios"(id) ON DELETE CASCADE,
  evento text NOT NULL DEFAULT 'basic_click_intent' CHECK (evento = 'basic_click_intent'),
  fuente text NOT NULL DEFAULT 'listado' CHECK (fuente IN ('listado', 'busqueda')),
  municipio_usuario text,
  user_id uuid,
  session_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS basic_click_intents_comercio_created_idx
  ON public.basic_click_intents ("idComercio", created_at DESC);

CREATE INDEX IF NOT EXISTS basic_click_intents_evento_created_idx
  ON public.basic_click_intents (evento, created_at DESC);

ALTER TABLE public.basic_click_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "basic_click_intents_insert_public" ON public.basic_click_intents;
CREATE POLICY "basic_click_intents_insert_public"
ON public.basic_click_intents
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "basic_click_intents_select_owner" ON public.basic_click_intents;
CREATE POLICY "basic_click_intents_select_owner"
ON public.basic_click_intents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public."UsuarioComercios" uc
    WHERE uc."idComercio" = basic_click_intents."idComercio"
      AND uc."idUsuario" = auth.uid()
  )
);

COMMIT;
