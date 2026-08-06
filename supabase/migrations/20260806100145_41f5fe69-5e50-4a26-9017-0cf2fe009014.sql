ALTER VIEW public.public_driver_pages SET (security_invoker = on);

-- Anonymous visitors: column-limited access, only to public driver pages
REVOKE ALL ON public.driver_profiles FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.vehicles FROM anon;

GRANT SELECT (user_id, slug, business_name, bio, city, zone, languages, services, page_published, verification_status)
  ON public.driver_profiles TO anon;
GRANT SELECT (id, full_name, avatar_url) ON public.profiles TO anon;
GRANT SELECT (driver_id, brand, model, color, photo_url, max_passengers, luggage_capacity,
              child_seat, chargers, water, pets_allowed, accessible, is_primary, created_at)
  ON public.vehicles TO anon;

CREATE POLICY driver_profiles_public_page ON public.driver_profiles FOR SELECT TO anon
USING (verification_status = 'verified' AND page_published);

CREATE POLICY profiles_public_driver_identity ON public.profiles FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.driver_profiles d
  WHERE d.user_id = profiles.id AND d.verification_status = 'verified' AND d.page_published
));

CREATE POLICY vehicles_public_page ON public.vehicles FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.driver_profiles d
  WHERE d.user_id = vehicles.driver_id AND d.verification_status = 'verified' AND d.page_published
));