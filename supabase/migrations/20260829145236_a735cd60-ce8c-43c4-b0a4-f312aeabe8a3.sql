ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS experience_years integer,
  ADD COLUMN IF NOT EXISTS website_url text;

CREATE TABLE IF NOT EXISTS public.driver_profile_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, driver_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_profile_views TO authenticated;
GRANT ALL ON public.driver_profile_views TO service_role;

ALTER TABLE public.driver_profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile_views_select" ON public.driver_profile_views
  FOR SELECT TO authenticated USING (client_id = auth.uid());
CREATE POLICY "own_profile_views_insert" ON public.driver_profile_views
  FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid());
CREATE POLICY "own_profile_views_update" ON public.driver_profile_views
  FOR UPDATE TO authenticated USING (client_id = auth.uid()) WITH CHECK (client_id = auth.uid());
CREATE POLICY "own_profile_views_delete" ON public.driver_profile_views
  FOR DELETE TO authenticated USING (client_id = auth.uid());

CREATE TRIGGER update_driver_profile_views_updated_at
  BEFORE UPDATE ON public.driver_profile_views
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS driver_profile_views_client_idx
  ON public.driver_profile_views (client_id, viewed_at DESC);

CREATE OR REPLACE FUNCTION public.get_public_driver_pricing(_slug text)
RETURNS TABLE(
  driver_id uuid,
  price_per_km numeric,
  minimum numeric,
  pickup_pct numeric,
  basis text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT d.user_id, t.price_per_km_ht, t.minimum_ht, t.pickup_pct, t.basis
  FROM public.driver_profiles d
  JOIN public.driver_tariffs t ON t.driver_id = d.user_id
  WHERE d.slug = _slug
    AND d.verification_status = 'verified'
    AND d.page_published
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_driver_pricing(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_driver_pricing(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_driver_visibility_stats(_days integer DEFAULT 30)
RETURNS TABLE(
  profile_views bigint,
  search_appearances bigint,
  network_adds bigint,
  contact_clicks bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH bounds AS (
    SELECT now() - (GREATEST(1, LEAST(COALESCE(_days, 30), 365)) || ' days')::interval AS since
  )
  SELECT
    (SELECT count(*) FROM public.analytics_events a, bounds b
      WHERE a.driver_id = auth.uid() AND a.created_at >= b.since AND a.event = 'page_view'),
    (SELECT count(*) FROM public.analytics_events a, bounds b
      WHERE a.driver_id = auth.uid() AND a.created_at >= b.since AND a.event = 'search_appearance'),
    (SELECT count(*) FROM public.driver_client_connections c, bounds b
      WHERE c.driver_id = auth.uid() AND c.created_at >= b.since),
    (SELECT count(*) FROM public.analytics_events a, bounds b
      WHERE a.driver_id = auth.uid() AND a.created_at >= b.since AND a.event = 'contact_click');
$$;

REVOKE ALL ON FUNCTION public.get_driver_visibility_stats(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_driver_visibility_stats(integer) TO authenticated, service_role;