-- Les profils Woman for Woman restent visibles dans l'annuaire et leur vitrine
-- publique peut être consultée par tous. Les règles existantes continuent de
-- protéger l'ajout au carnet et la mise en relation côté serveur.

CREATE OR REPLACE FUNCTION public.search_public_drivers(
  _q text DEFAULT NULL::text,
  _department text DEFAULT NULL::text,
  _service text DEFAULT NULL::text,
  _category text DEFAULT NULL::text,
  _min_passengers integer DEFAULT NULL::integer,
  _language text DEFAULT NULL::text,
  _limit integer DEFAULT 40,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  user_id uuid, slug text, display_name text, full_name text, avatar_url text,
  city text, zone text, public_intro text, services text[], languages text[],
  service_areas text[], service_departments text[], experience_years integer,
  vehicle_brand text, vehicle_model text, vehicle_category text,
  vehicle_photo_url text, max_passengers integer, luggage_capacity integer,
  woman_for_woman boolean, member_since timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  WHERE d.page_published
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
$function$;

REVOKE ALL ON FUNCTION public.search_public_drivers(text, text, text, text, integer, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_drivers(text, text, text, text, integer, text, integer, integer) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_public_driver_page(text);

CREATE FUNCTION public.get_public_driver_page(_slug text)
RETURNS TABLE(
  user_id uuid, slug text, business_name text, bio text, public_intro text,
  city text, zone text, service_areas text[], stations text[], airports text[],
  long_distance boolean, availability text[], booking_notice text,
  accepting_requests boolean, member_since timestamp with time zone,
  languages text[], services text[], full_name text, avatar_url text,
  vehicle_brand text, vehicle_model text, vehicle_color text, vehicle_year integer,
  vehicle_category text, vehicle_photo_url text, vehicle_interior_photo_url text,
  vehicle_front_photo_url text, vehicle_side_photo_url text, vehicle_trunk_photo_url text,
  max_passengers integer, luggage_capacity integer, large_luggage_capacity integer,
  cabin_luggage_capacity integer, pets_policy text, pets_max integer,
  pets_carrier_required boolean, pets_conditions text, child_seat boolean,
  booster_seat boolean, stroller_space boolean, accessible boolean,
  large_trunk boolean, air_conditioning boolean, chargers boolean, water boolean,
  card_payment boolean, quiet_ride boolean, luggage_help boolean, pets_allowed boolean,
  company_verified boolean, verified_docs text[], public_phone text,
  whatsapp_number text, instagram_url text, facebook_url text, tiktok_url text,
  linkedin_url text, woman_for_woman boolean, website_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT d.user_id, d.slug, d.business_name, d.bio, d.public_intro,
         d.city, d.zone, d.service_areas, d.stations, d.airports,
         d.long_distance, d.availability, d.booking_notice,
         d.accepting_requests, d.created_at,
         d.languages, d.services, p.full_name, p.avatar_url,
         v.brand, v.model, v.color, v.year, v.category, v.photo_url, v.photo_interior_url,
         v.photo_front_url, v.photo_side_url, v.photo_trunk_url,
         v.max_passengers, v.luggage_capacity,
         v.large_luggage_capacity, v.cabin_luggage_capacity,
         v.pets_policy, v.pets_max, v.pets_carrier_required, v.pets_conditions,
         v.child_seat, v.booster_seat, v.stroller_space, v.accessible, v.large_trunk,
         v.air_conditioning, v.chargers, v.water, v.card_payment,
         v.quiet_ride, v.luggage_help, v.pets_allowed,
         EXISTS (
           SELECT 1 FROM public.companies c
           WHERE c.driver_id = d.user_id AND c.siret IS NOT NULL
         ),
         COALESCE((
           SELECT array_agg(DISTINCT vd.doc_type)
           FROM public.verification_documents vd
           WHERE vd.driver_id = d.user_id AND vd.status = 'approved'
         ), '{}'),
         CASE WHEN d.show_public_phone THEN d.public_phone END,
         CASE WHEN d.show_whatsapp THEN d.whatsapp_number END,
         d.instagram_url, d.facebook_url, d.tiktok_url, d.linkedin_url,
         d.woman_for_woman,
         d.website_url
  FROM public.driver_profiles d
  JOIN public.profiles p ON p.id = d.user_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.vehicles vv
    WHERE vv.driver_id = d.user_id
    ORDER BY vv.is_primary DESC, vv.created_at
    LIMIT 1
  ) v ON true
  WHERE d.slug = _slug
    AND d.verification_status = 'verified'
    AND d.page_published;
$function$;

REVOKE ALL ON FUNCTION public.get_public_driver_page(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_driver_page(text) TO anon, authenticated;
