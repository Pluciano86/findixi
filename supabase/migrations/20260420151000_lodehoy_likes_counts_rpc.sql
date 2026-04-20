BEGIN;

CREATE OR REPLACE FUNCTION public.fn_lodehoy_likes_counts(p_comercios bigint[])
RETURNS TABLE(idcomercio bigint, likes_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.idcomercio,
    COUNT(*)::bigint AS likes_count
  FROM public.lodehoy_likes_comercio AS l
  WHERE p_comercios IS NOT NULL
    AND array_length(p_comercios, 1) > 0
    AND l.idcomercio = ANY (p_comercios)
  GROUP BY l.idcomercio;
$$;

REVOKE ALL ON FUNCTION public.fn_lodehoy_likes_counts(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_lodehoy_likes_counts(bigint[]) TO anon, authenticated;

COMMIT;
