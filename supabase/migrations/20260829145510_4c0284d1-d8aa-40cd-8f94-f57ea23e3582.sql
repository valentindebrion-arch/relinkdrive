CREATE OR REPLACE FUNCTION public.search_public_drivers(
  _q text DEFAULT NULL,
  _department text DEFAULT NULL,
  _service text DEFAULT NULL,
  _category text DEFAULT NULL,
  _min_passengers integer DEFAULT NULL,
  _language text DEFAULT NULL,
  _limit integer DEFAULT 40,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  user_id uuid,
  slug text,
  display_name text,
  full_name text,
  avatar_url text,
  city text,
  zone text,
  public_intro text,
  services text[],
  languages text[],
  service_areas text[],
  service_departments text[],
  experience_years integer,
  vehicle_brand text,
  vehicle_model text,
  vehicle_category text,
  vehicle_photo_url text,
  max_passengers integer,
  luggage_capacity integer,
  woman_for_woman boolean,
  member_since timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT d.user_id, d.slug,
         COALESCE(NULLIF(d.business_name, ''), p.full_name, 'Chauffeur'),
         p.full_name, p.avatar_url,
         d.city, d.zone, d.public_intro,
         d.services, d.languages, d.service_areas, d.service_departments,
         d.experience_years,
         v.brand, v.model, v.category, v.photo_url, v.max_passengers, v.luggage_capacity,
         d.woman_for_woman, d.created_at
  FROM public.driver_profiles d
  JOIN public.profiles p ON p.id = d.user_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.vehicles vv
    WHERE vv.driver_id = d.user_id
    ORDER BY vv.is_primary DESC, vv.created_at
    LIMIT 1
  ) v ON true
  WHERE d.verification_status = 'verified'
    AND d.page_published
    AND (
      _q IS NULL OR btrim(_q) = '' OR
      (
        COALESCE(d.city,'') || ' ' || COALESCE(d.zone,'') || ' ' ||
        COALESCE(d.business_name,'') || ' ' || COALESCE(p.full_name,'') || ' ' ||
        COALESCE(array_to_string(d.service_areas, ' '), '')
      ) ILIKE '%' || btrim(_q) || '%'
    )
    AND (_department IS NULL OR _department = ANY (COALESCE(d.service_departments, ARRAY[]::text[])))
    AND (_service IS NULL OR _service = ANY (COALESCE(d.services, ARRAY[]::text[])))
    AND (_language IS NULL OR _language = ANY (COALESCE(d.languages, ARRAY[]::text[])))
    AND (_category IS NULL OR v.category = _category)
    AND (_min_passengers IS NULL OR COALESCE(v.max_passengers, 0) >= _min_passengers)
  ORDER BY d.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 40), 60))
  OFFSET GREATEST(0, COALESCE(_offset, 0));
$$;

REVOKE ALL ON FUNCTION public.search_public_drivers(text, text, text, text, integer, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_drivers(text, text, text, text, integer, text, integer, integer)
  TO anon, authenticated, service_role;