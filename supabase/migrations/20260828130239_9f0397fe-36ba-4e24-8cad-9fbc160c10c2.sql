REVOKE INSERT, UPDATE, DELETE ON public.geo_place_cache FROM authenticated, anon;

DROP POLICY IF EXISTS "geo_place_cache_no_client_write" ON public.geo_place_cache;
CREATE POLICY "geo_place_cache_no_client_write" ON public.geo_place_cache
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (false);