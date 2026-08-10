DROP POLICY IF EXISTS driver_profile_visible_to_connected_client ON public.driver_profiles;

CREATE OR REPLACE VIEW public.connected_driver_profiles AS
SELECT
  d.user_id,
  d.slug,
  d.business_name,
  d.bio,
  d.public_intro,
  d.city,
  d.zone,
  d.service_areas,
  d.stations,
  d.airports,
  d.long_distance,
  d.availability,
  d.booking_notice,
  d.accepting_requests,
  d.languages,
  d.services,
  d.on_duty,
  d.page_published,
  d.created_at,
  CASE WHEN d.show_public_phone THEN d.public_phone END AS public_phone,
  CASE WHEN d.show_whatsapp THEN d.whatsapp_number END AS whatsapp_number,
  d.instagram_url,
  d.facebook_url,
  d.tiktok_url,
  d.linkedin_url
FROM public.driver_profiles d
WHERE public.is_connected(auth.uid(), d.user_id);

REVOKE ALL ON public.connected_driver_profiles FROM anon;
GRANT SELECT ON public.connected_driver_profiles TO authenticated;