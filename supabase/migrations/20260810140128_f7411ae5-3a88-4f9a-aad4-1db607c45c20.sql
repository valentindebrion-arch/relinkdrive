DROP VIEW IF EXISTS public.connected_driver_profiles;

CREATE OR REPLACE FUNCTION public.get_connected_driver_profiles()
RETURNS TABLE(
  user_id uuid, slug text, business_name text, bio text, public_intro text,
  city text, zone text, service_areas text[], stations text[], airports text[],
  long_distance boolean, availability text[], booking_notice text,
  accepting_requests boolean, languages text[], services text[], on_duty boolean,
  page_published boolean, created_at timestamptz, public_phone text,
  whatsapp_number text, instagram_url text, facebook_url text, tiktok_url text, linkedin_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT d.user_id, d.slug, d.business_name, d.bio, d.public_intro,
         d.city, d.zone, d.service_areas, d.stations, d.airports,
         d.long_distance, d.availability, d.booking_notice,
         d.accepting_requests, d.languages, d.services, d.on_duty,
         d.page_published, d.created_at,
         CASE WHEN d.show_public_phone THEN d.public_phone END,
         CASE WHEN d.show_whatsapp THEN d.whatsapp_number END,
         d.instagram_url, d.facebook_url, d.tiktok_url, d.linkedin_url
  FROM public.driver_profiles d
  WHERE auth.uid() IS NOT NULL AND public.is_connected(auth.uid(), d.user_id);
$$;

REVOKE ALL ON FUNCTION public.get_connected_driver_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_connected_driver_profiles() TO authenticated;