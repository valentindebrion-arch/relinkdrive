ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS service_departments text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.geo_place_cache
  ADD COLUMN IF NOT EXISTS postcode text;

CREATE OR REPLACE FUNCTION public.relink_department_code(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  WITH v AS (SELECT upper(trim(coalesce(_value, ''))) AS t)
  SELECT CASE
    WHEN v.t ~ '^(2A|2B)$' THEN v.t
    WHEN v.t ~ '^(97|98)[0-9]$' THEN v.t
    WHEN v.t ~ '^[0-9]{2}$' AND v.t <> '00' THEN v.t
    WHEN v.t ~ '^[0-9]{5}$' THEN
      CASE
        WHEN left(v.t, 2) IN ('97', '98') THEN left(v.t, 3)
        WHEN left(v.t, 3) IN ('200', '201') THEN '2A'
        WHEN left(v.t, 2) = '20' THEN '2B'
        ELSE left(v.t, 2)
      END
    ELSE NULL
  END
  FROM v;
$$;

UPDATE public.driver_profiles d
SET service_departments = sub.codes
FROM (
  SELECT p.user_id,
         array_agg(DISTINCT c.code) FILTER (WHERE c.code IS NOT NULL) AS codes
  FROM public.driver_profiles p
  LEFT JOIN LATERAL unnest(coalesce(p.service_areas, '{}'::text[]) || ARRAY[p.zone, p.city]) AS a(txt) ON true
  LEFT JOIN LATERAL (SELECT public.relink_department_code(a.txt) AS code) c ON true
  GROUP BY p.user_id
) sub
WHERE sub.user_id = d.user_id
  AND sub.codes IS NOT NULL
  AND array_length(sub.codes, 1) > 0
  AND coalesce(array_length(d.service_departments, 1), 0) = 0;

DROP FUNCTION IF EXISTS public.get_local_drivers(text, integer);

CREATE OR REPLACE FUNCTION public.get_local_drivers(_sector text DEFAULT NULL::text, _limit integer DEFAULT 60)
 RETURNS TABLE(user_id uuid, slug text, display_name text, avatar_url text, city text, zone text, service_areas text[], service_departments text[], public_intro text, bio text, services text[], long_distance boolean, airports text[], on_duty boolean, accepting_requests boolean, member_since timestamp with time zone, vehicle_brand text, vehicle_model text, vehicle_category text, vehicle_photo_url text, vehicle_interior_photo_url text, max_passengers integer, price_per_km numeric, rating_avg numeric, rating_count bigint, woman_for_woman boolean, rank_position integer, sector_match boolean, quality_score numeric)
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
         r.rating_avg, COALESCE(r.rating_count, 0),
         d.woman_for_woman,
         t.rank_position,
         m.matched,
         (COALESCE(r.rating_avg, 0) * 2)
           + LEAST(COALESCE(r.rating_count, 0), 20) * 0.15
           + (CASE WHEN t.rank_position IS NOT NULL THEN 3 ELSE 0 END)
           + (CASE WHEN COALESCE(d.public_intro, '') <> '' THEN 0.5 ELSE 0 END)
           + (CASE WHEN COALESCE(d.bio, '') <> '' THEN 0.5 ELSE 0 END)
           + (CASE WHEN v.photo_url IS NOT NULL THEN 0.5 ELSE 0 END)
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
  LEFT JOIN LATERAL (
    SELECT round(avg(rr.rating)::numeric, 2) AS rating_avg, count(*) AS rating_count
    FROM public.ride_reviews rr
    WHERE rr.driver_id = d.user_id AND rr.status = 'visible'
  ) r ON true
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
  ORDER BY quality_score DESC, COALESCE(r.rating_avg, 0) DESC, d.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 60), 100));
$function$;

REVOKE ALL ON FUNCTION public.get_local_drivers(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_local_drivers(text, integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.relink_department_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relink_department_code(text) TO authenticated, service_role;