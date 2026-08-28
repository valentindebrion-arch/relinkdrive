CREATE TABLE IF NOT EXISTS public.geo_place_cache (
  name_norm text PRIMARY KEY,
  label text,
  lat double precision,
  lng double precision,
  resolved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.geo_place_cache TO authenticated;
GRANT ALL ON public.geo_place_cache TO service_role;

ALTER TABLE public.geo_place_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geo_place_cache_read" ON public.geo_place_cache
  FOR SELECT TO authenticated USING (true);