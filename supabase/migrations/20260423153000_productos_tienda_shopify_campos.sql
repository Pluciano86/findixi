BEGIN;

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS imagenes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS variantes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS enlace_compra text,
  ADD COLUMN IF NOT EXISTS origen_catalogo text NOT NULL DEFAULT 'findixi',
  ADD COLUMN IF NOT EXISTS shopify_product_id text,
  ADD COLUMN IF NOT EXISTS shopify_handle text,
  ADD COLUMN IF NOT EXISTS shopify_updated_at timestamptz;

UPDATE public.productos
SET imagenes =
  CASE
    WHEN jsonb_typeof(imagenes) = 'array' THEN imagenes
    WHEN imagenes IS NULL THEN '[]'::jsonb
    ELSE jsonb_build_array(imagenes)
  END;

UPDATE public.productos
SET variantes =
  CASE
    WHEN jsonb_typeof(variantes) = 'array' OR jsonb_typeof(variantes) = 'object' THEN variantes
    WHEN variantes IS NULL THEN '[]'::jsonb
    ELSE '[]'::jsonb
  END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'productos_origen_catalogo_chk'
      AND conrelid = 'public.productos'::regclass
  ) THEN
    ALTER TABLE public.productos
      ADD CONSTRAINT productos_origen_catalogo_chk
      CHECK (origen_catalogo IN ('findixi', 'shopify', 'externo'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS productos_origen_catalogo_idx
  ON public.productos (origen_catalogo);

CREATE INDEX IF NOT EXISTS productos_shopify_product_id_idx
  ON public.productos (shopify_product_id);

CREATE INDEX IF NOT EXISTS productos_shopify_updated_at_idx
  ON public.productos (shopify_updated_at DESC);

COMMIT;
