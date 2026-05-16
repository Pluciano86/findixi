BEGIN;

CREATE TABLE IF NOT EXISTS public.sugerencias_cambios_lugares (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_lugar bigint REFERENCES public."LugaresTuristicos"(id) ON DELETE SET NULL,
  nombre_lugar text,
  categoria_sugerencia text NOT NULL DEFAULT 'otro',
  campo text,
  valor_actual text,
  valor_sugerido text,
  comentario text NOT NULL,
  nombre_contacto text,
  email_contacto text,
  telefono_contacto text,
  fuente text NOT NULL DEFAULT 'perfilLugar',
  user_id uuid,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_revision', 'resuelto', 'descartado')),
  nota_revision text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sugerencias_cambios_lugares_lugar_created_idx
  ON public.sugerencias_cambios_lugares (id_lugar, created_at DESC);

CREATE INDEX IF NOT EXISTS sugerencias_cambios_lugares_estado_created_idx
  ON public.sugerencias_cambios_lugares (estado, created_at DESC);

CREATE INDEX IF NOT EXISTS sugerencias_cambios_lugares_fuente_created_idx
  ON public.sugerencias_cambios_lugares (fuente, created_at DESC);

CREATE OR REPLACE FUNCTION public.fn_touch_updated_at_sugerencias_cambios_lugares()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_updated_at_sugerencias_cambios_lugares ON public.sugerencias_cambios_lugares;
CREATE TRIGGER trg_touch_updated_at_sugerencias_cambios_lugares
BEFORE UPDATE ON public.sugerencias_cambios_lugares
FOR EACH ROW
EXECUTE FUNCTION public.fn_touch_updated_at_sugerencias_cambios_lugares();

ALTER TABLE public.sugerencias_cambios_lugares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sugerencias_cambios_lugares_insert_public" ON public.sugerencias_cambios_lugares;
CREATE POLICY "sugerencias_cambios_lugares_insert_public"
ON public.sugerencias_cambios_lugares
FOR INSERT
TO anon, authenticated
WITH CHECK (char_length(trim(coalesce(comentario, ''))) >= 8);

DROP POLICY IF EXISTS "sugerencias_cambios_lugares_select_admin" ON public.sugerencias_cambios_lugares;
CREATE POLICY "sugerencias_cambios_lugares_select_admin"
ON public.sugerencias_cambios_lugares
FOR SELECT
TO authenticated
USING (public.fn_is_app_admin(auth.uid()));

COMMIT;

