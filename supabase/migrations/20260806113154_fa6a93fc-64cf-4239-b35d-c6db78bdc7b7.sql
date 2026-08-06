
ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS public_intro text,
  ADD COLUMN IF NOT EXISTS service_areas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stations text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS airports text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS long_distance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS availability text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS booking_notice text,
  ADD COLUMN IF NOT EXISTS accepting_requests boolean NOT NULL DEFAULT true;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS photo_interior_url text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS air_conditioning boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS card_payment boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_ride boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS luggage_help boolean NOT NULL DEFAULT true;

DROP FUNCTION IF EXISTS public.get_public_driver_page(text);

CREATE FUNCTION public.get_public_driver_page(_slug text)
RETURNS TABLE(
  user_id uuid, slug text, business_name text, bio text, public_intro text,
  city text, zone text, service_areas text[], stations text[], airports text[],
  long_distance boolean, availability text[], booking_notice text,
  accepting_requests boolean, member_since timestamptz,
  languages text[], services text[], full_name text, avatar_url text,
  vehicle_brand text, vehicle_model text, vehicle_color text, vehicle_year integer,
  vehicle_category text, vehicle_photo_url text, vehicle_interior_photo_url text,
  max_passengers integer, luggage_capacity integer,
  air_conditioning boolean, chargers boolean, water boolean, card_payment boolean,
  quiet_ride boolean, luggage_help boolean, pets_allowed boolean,
  company_verified boolean, verified_docs text[]
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
         v.max_passengers, v.luggage_capacity,
         v.air_conditioning, v.chargers, v.water, v.card_payment,
         v.quiet_ride, v.luggage_help, v.pets_allowed,
         EXISTS (SELECT 1 FROM public.companies c WHERE c.driver_id = d.user_id AND c.siret IS NOT NULL),
         COALESCE((
           SELECT array_agg(DISTINCT vd.doc_type)
           FROM public.verification_documents vd
           WHERE vd.driver_id = d.user_id AND vd.status = 'approved'
         ), '{}')
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

CREATE OR REPLACE FUNCTION public.track_driver_event(_slug text, _event text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _driver uuid; _city text;
BEGIN
  IF _event NOT IN ('driver_page_view','driver_add_click','driver_signup_started','driver_request_click') THEN
    RETURN;
  END IF;
  SELECT d.user_id, d.city INTO _driver, _city
  FROM public.driver_profiles d
  WHERE d.slug = _slug AND d.verification_status = 'verified' AND d.page_published;
  IF _driver IS NULL THEN RETURN; END IF;
  INSERT INTO public.analytics_events (event, driver_id, city)
  VALUES (_event, _driver, _city);
END; $function$;

REVOKE ALL ON FUNCTION public.track_driver_event(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_driver_event(text, text) TO anon, authenticated;
