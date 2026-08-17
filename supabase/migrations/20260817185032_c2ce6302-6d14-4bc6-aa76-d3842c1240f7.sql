DROP FUNCTION IF EXISTS public.get_public_driver_page(text);

CREATE FUNCTION public.get_public_driver_page(_slug text)
 RETURNS TABLE(user_id uuid, slug text, business_name text, bio text, public_intro text, city text, zone text, service_areas text[], stations text[], airports text[], long_distance boolean, availability text[], booking_notice text, accepting_requests boolean, member_since timestamp with time zone, languages text[], services text[], full_name text, avatar_url text, vehicle_brand text, vehicle_model text, vehicle_color text, vehicle_year integer, vehicle_category text, vehicle_photo_url text, vehicle_interior_photo_url text, max_passengers integer, luggage_capacity integer, large_luggage_capacity integer, cabin_luggage_capacity integer, pets_policy text, pets_max integer, pets_carrier_required boolean, pets_conditions text, child_seat boolean, booster_seat boolean, stroller_space boolean, accessible boolean, large_trunk boolean, air_conditioning boolean, chargers boolean, water boolean, card_payment boolean, quiet_ride boolean, luggage_help boolean, pets_allowed boolean, company_verified boolean, verified_docs text[], public_phone text, whatsapp_number text, instagram_url text, facebook_url text, tiktok_url text, linkedin_url text)
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
         v.max_passengers, v.luggage_capacity,
         v.large_luggage_capacity, v.cabin_luggage_capacity,
         v.pets_policy, v.pets_max, v.pets_carrier_required, v.pets_conditions,
         v.child_seat, v.booster_seat, v.stroller_space, v.accessible, v.large_trunk,
         v.air_conditioning, v.chargers, v.water, v.card_payment,
         v.quiet_ride, v.luggage_help, v.pets_allowed,
         EXISTS (SELECT 1 FROM public.companies c WHERE c.driver_id = d.user_id AND c.siret IS NOT NULL),
         COALESCE((
           SELECT array_agg(DISTINCT vd.doc_type)
           FROM public.verification_documents vd
           WHERE vd.driver_id = d.user_id AND vd.status = 'approved'
         ), '{}'),
         CASE WHEN d.show_public_phone THEN d.public_phone END,
         CASE WHEN d.show_whatsapp THEN d.whatsapp_number END,
         d.instagram_url, d.facebook_url, d.tiktok_url, d.linkedin_url
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

GRANT EXECUTE ON FUNCTION public.get_public_driver_page(text) TO anon, authenticated;