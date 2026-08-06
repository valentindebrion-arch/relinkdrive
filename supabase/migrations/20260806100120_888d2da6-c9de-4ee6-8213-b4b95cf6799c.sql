-- 1. Remove overly broad public SELECT policies
DROP POLICY IF EXISTS driver_public_page ON public.driver_profiles;
DROP POLICY IF EXISTS profiles_public_verified_drivers ON public.profiles;
DROP POLICY IF EXISTS vehicles_public_for_verified ON public.vehicles;

-- 2. Keep connected clients able to see their drivers' data (authenticated only)
CREATE POLICY driver_profile_visible_to_connected_client
ON public.driver_profiles FOR SELECT TO authenticated
USING (public.is_connected(auth.uid(), user_id));

CREATE POLICY profiles_visible_to_connected_client
ON public.profiles FOR SELECT TO authenticated
USING (public.is_connected(auth.uid(), id));

CREATE POLICY vehicles_visible_to_connected_client
ON public.vehicles FOR SELECT TO authenticated
USING (public.is_connected(auth.uid(), driver_id));

-- 3. Public driver page exposed through a safe, column-limited view
CREATE OR REPLACE VIEW public.public_driver_pages AS
SELECT
  d.user_id,
  d.slug,
  d.business_name,
  d.bio,
  d.city,
  d.zone,
  d.languages,
  d.services,
  p.full_name,
  p.avatar_url,
  v.brand        AS vehicle_brand,
  v.model        AS vehicle_model,
  v.color        AS vehicle_color,
  v.photo_url    AS vehicle_photo_url,
  v.max_passengers,
  v.luggage_capacity,
  v.child_seat,
  v.chargers,
  v.water,
  v.pets_allowed,
  v.accessible
FROM public.driver_profiles d
JOIN public.profiles p ON p.id = d.user_id
LEFT JOIN LATERAL (
  SELECT * FROM public.vehicles vv
  WHERE vv.driver_id = d.user_id
  ORDER BY vv.is_primary DESC, vv.created_at
  LIMIT 1
) v ON true
WHERE d.verification_status = 'verified' AND d.page_published;

ALTER VIEW public.public_driver_pages SET (security_invoker = off);

GRANT SELECT ON public.public_driver_pages TO anon, authenticated;

-- 4. Restrict notification creation
DROP POLICY IF EXISTS notif_insert ON public.notifications;
CREATE POLICY notif_insert ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_connected(auth.uid(), user_id)
  OR public.is_connected(user_id, auth.uid())
  OR public.is_admin(auth.uid())
);