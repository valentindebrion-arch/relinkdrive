CREATE TABLE public.top10_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  rank_position integer NOT NULL CHECK (rank_position BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.top10_drivers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.top10_drivers TO authenticated;
GRANT ALL ON public.top10_drivers TO service_role;

ALTER TABLE public.top10_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "top10_select_authenticated" ON public.top10_drivers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "top10_admin_insert" ON public.top10_drivers
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "top10_admin_update" ON public.top10_drivers
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "top10_admin_delete" ON public.top10_drivers
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_top10_drivers_updated_at
  BEFORE UPDATE ON public.top10_drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_top10_drivers()
RETURNS TABLE(
  rank_position integer,
  user_id uuid,
  slug text,
  display_name text,
  full_name text,
  avatar_url text,
  city text,
  zone text,
  public_intro text,
  bio text,
  services text[],
  languages text[],
  long_distance boolean,
  airports text[],
  on_duty boolean,
  accepting_requests boolean,
  member_since timestamptz,
  vehicle_brand text,
  vehicle_model text,
  vehicle_category text,
  vehicle_photo_url text,
  vehicle_interior_photo_url text,
  max_passengers integer,
  price_per_km numeric,
  rating_avg numeric,
  rating_count bigint,
  already_connected boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT t.rank_position, d.user_id, d.slug,
         COALESCE(NULLIF(d.business_name, ''), p.full_name, 'Chauffeur'),
         p.full_name, p.avatar_url,
         d.city, d.zone, d.public_intro, d.bio,
         d.services, d.languages, d.long_distance, d.airports,
         d.on_duty, d.accepting_requests, d.created_at,
         v.brand, v.model, v.category, v.photo_url, v.photo_interior_url, v.max_passengers,
         tar.price_per_km,
         r.rating_avg, COALESCE(r.rating_count, 0),
         EXISTS (
           SELECT 1 FROM public.driver_client_connections c
           WHERE c.client_id = auth.uid() AND c.driver_id = d.user_id
         )
  FROM public.top10_drivers t
  JOIN public.driver_profiles d ON d.user_id = t.driver_id
  JOIN public.profiles p ON p.id = d.user_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.vehicles vv
    WHERE vv.driver_id = d.user_id
    ORDER BY vv.is_primary DESC, vv.created_at
    LIMIT 1
  ) v ON true
  LEFT JOIN LATERAL (
    SELECT dt.price_per_km_ht AS price_per_km FROM public.driver_tariffs dt
    WHERE dt.driver_id = d.user_id
    ORDER BY dt.created_at DESC
    LIMIT 1
  ) tar ON true
  LEFT JOIN LATERAL (
    SELECT round(avg(rr.rating)::numeric, 2) AS rating_avg, count(*) AS rating_count
    FROM public.ride_reviews rr
    WHERE rr.driver_id = d.user_id AND rr.status = 'visible'
  ) r ON true
  WHERE auth.uid() IS NOT NULL
    AND d.verification_status = 'verified'
    AND d.page_published
  ORDER BY t.rank_position;
$function$;

REVOKE ALL ON FUNCTION public.get_top10_drivers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_top10_drivers() TO authenticated;