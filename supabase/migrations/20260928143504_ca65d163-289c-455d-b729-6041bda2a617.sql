DROP POLICY IF EXISTS "geo_place_cache_read" ON public.geo_place_cache;
REVOKE SELECT ON public.geo_place_cache FROM authenticated, anon;