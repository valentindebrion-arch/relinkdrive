CREATE OR REPLACE FUNCTION public.get_discover_drivers(_limit integer DEFAULT 20)
RETURNS TABLE(
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
  rating_avg numeric,
  rating_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT d.user_id, d.slug,
         COALESCE(NULLIF(d.business_name, ''), p.full_name, 'Chauffeur'),
         p.full_name, p.avatar_url,
         d.city, d.zone, d.public_intro, d.bio,
         d.services, d.languages, d.long_distance, d.airports,
         d.on_duty, d.accepting_requests, d.created_at,
         v.brand, v.model, v.category, v.photo_url, v.photo_interior_url, v.max_passengers,
         r.rating_avg, COALESCE(r.rating_count, 0)
  FROM public.driver_profiles d
  JOIN public.profiles p ON p.id = d.user_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.vehicles vv
    WHERE vv.driver_id = d.user_id
    ORDER BY vv.is_primary DESC, vv.created_at
    LIMIT 1
  ) v ON true
  LEFT JOIN LATERAL (
    SELECT round(avg(rr.rating)::numeric, 2) AS rating_avg, count(*) AS rating_count
    FROM public.ride_reviews rr
    WHERE rr.driver_id = d.user_id AND rr.status = 'visible'
  ) r ON true
  WHERE d.verification_status = 'verified'
    AND d.page_published
    AND auth.uid() IS NOT NULL
    AND d.user_id <> auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.driver_client_connections c
      WHERE c.client_id = auth.uid() AND c.driver_id = d.user_id
    )
  ORDER BY COALESCE(r.rating_avg, 0) DESC, COALESCE(r.rating_count, 0) DESC, d.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 50));
$function$;

REVOKE ALL ON FUNCTION public.get_discover_drivers(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_discover_drivers(integer) TO authenticated;