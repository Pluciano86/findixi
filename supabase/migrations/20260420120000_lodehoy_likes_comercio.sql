BEGIN;

CREATE TABLE IF NOT EXISTS public.lodehoy_likes_comercio (
  id bigserial PRIMARY KEY,
  idcomercio bigint NOT NULL REFERENCES public."Comercios"(id) ON DELETE CASCADE,
  idusuario uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idcomercio, idusuario)
);

CREATE INDEX IF NOT EXISTS lodehoy_likes_comercio_idcomercio_idx
  ON public.lodehoy_likes_comercio (idcomercio);

CREATE INDEX IF NOT EXISTS lodehoy_likes_comercio_idusuario_idx
  ON public.lodehoy_likes_comercio (idusuario);

ALTER TABLE public.lodehoy_likes_comercio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lodehoy_likes_select_self" ON public.lodehoy_likes_comercio;
CREATE POLICY "lodehoy_likes_select_self"
  ON public.lodehoy_likes_comercio
  FOR SELECT
  TO authenticated
  USING (idusuario = auth.uid());

DROP POLICY IF EXISTS "lodehoy_likes_select_comercio_owner" ON public.lodehoy_likes_comercio;
CREATE POLICY "lodehoy_likes_select_comercio_owner"
  ON public.lodehoy_likes_comercio
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."UsuarioComercios" uc
      WHERE uc."idComercio" = lodehoy_likes_comercio.idcomercio
        AND uc."idUsuario" = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public."Comercios" c
      WHERE c.id = lodehoy_likes_comercio.idcomercio
        AND c.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lodehoy_likes_insert_self" ON public.lodehoy_likes_comercio;
CREATE POLICY "lodehoy_likes_insert_self"
  ON public.lodehoy_likes_comercio
  FOR INSERT
  TO authenticated
  WITH CHECK (idusuario = auth.uid());

DROP POLICY IF EXISTS "lodehoy_likes_delete_self" ON public.lodehoy_likes_comercio;
CREATE POLICY "lodehoy_likes_delete_self"
  ON public.lodehoy_likes_comercio
  FOR DELETE
  TO authenticated
  USING (idusuario = auth.uid());

COMMIT;
