CREATE OR REPLACE FUNCTION public.get_local_drivers(_sector text DEFAULT NULL::text, _limit integer DEFAULT 60)
RETURNS TABLE(
  user_id uuid, slug text, display_name text, avatar_url text, city text, zone text,
  service_areas text[], service_departments text[], public_intro text, bio text,
  services text[], long_distance boolean, airports text[], on_duty boolean,
  accepting_requests boolean, member_since timestamptz, vehicle_brand text,
  vehicle_model text, vehicle_category text, vehicle_photo_url text,
  vehicle_interior_photo_url text, max_passengers integer, price_per_km numeric,
  rating_avg numeric, rating_count bigint, woman_for_woman boolean,
  rank_position integer, sector_match boolean, quality_score numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH s AS (SELECT NULLIF(public.relink_normalize(_sector), '') AS q)
  SELECT d.user_id, d.slug,
         COALESCE(NULLIF(d.business_name, ''), p.full_name, 'Chauffeur'),
         p.avatar_url, d.city, d.zone, d.service_areas, d.service_departments,
         d.public_intro, d.bio,
         d.services, d.long_distance, d.airports, d.on_duty, d.accepting_requests, d.created_at,
         v.brand, v.model, v.category, v.photo_url, v.photo_interior_url, v.max_passengers,
         tar.price_per_km,
         NULL::numeric, 0::bigint,
         d.woman_for_woman,
         t.rank_position,
         m.matched,
         (CASE WHEN t.rank_position IS NOT NULL THEN 3 ELSE 0 END)
           + (CASE WHEN COALESCE(d.public_intro, '') <> '' THEN 0.5 ELSE 0 END)
           + (CASE WHEN COALESCE(d.bio, '') <> '' THEN 0.5 ELSE 0 END)
           + (CASE WHEN v.photo_url IS NOT NULL THEN 1 ELSE 0 END)
           + (CASE WHEN COALESCE(array_length(d.services, 1), 0) > 0 THEN 0.5 ELSE 0 END)
           + (CASE WHEN tar.price_per_km IS NOT NULL THEN 0.5 ELSE 0 END)
           + (CASE WHEN d.on_duty THEN 0.5 ELSE 0 END) AS quality_score
  FROM public.driver_profiles d
  JOIN public.profiles p ON p.id = d.user_id
  CROSS JOIN s
  LEFT JOIN public.top10_drivers t ON t.driver_id = d.user_id
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
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN s.q IS NULL THEN false
      ELSE EXISTS (
        SELECT 1
        FROM unnest(
          ARRAY[d.city, d.zone] || COALESCE(d.service_areas, ARRAY[]::text[])
        ) AS area(txt)
        WHERE NULLIF(public.relink_normalize(area.txt), '') IS NOT NULL
          AND (public.relink_normalize(area.txt) LIKE '%' || s.q || '%'
               OR s.q LIKE '%' || public.relink_normalize(area.txt) || '%')
      )
    END AS matched
  ) m
  WHERE auth.uid() IS NOT NULL
    AND d.verification_status = 'verified'
    AND d.page_published
    AND d.user_id <> auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.driver_client_connections c
      WHERE c.client_id = auth.uid() AND c.driver_id = d.user_id
    )
    AND (s.q IS NULL OR m.matched)
  ORDER BY quality_score DESC, d.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 60), 100));
$function$;