DROP VIEW IF EXISTS public.public_driver_pages;

DROP POLICY IF EXISTS driver_profiles_public_page ON public.driver_profiles;
DROP POLICY IF EXISTS profiles_public_driver_identity ON public.profiles;
DROP POLICY IF EXISTS vehicles_public_page ON public.vehicles;

REVOKE ALL ON public.driver_profiles FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.vehicles FROM anon;

CREATE OR REPLACE FUNCTION public.get_public_driver_page(_slug text)
RETURNS TABLE (
  user_id uuid,
  slug text,
  business_name text,
  bio text,
  city text,
  zone text,
  languages text[],
  services text[],
  full_name text,
  avatar_url text,
  vehicle_brand text,
  vehicle_model text,
  vehicle_color text,
  vehicle_photo_url text,
  max_passengers integer,
  luggage_capacity integer,
  child_seat boolean,
  chargers boolean,
  water boolean,
  pets_allowed boolean,
  accessible boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.user_id, d.slug, d.business_name, d.bio, d.city, d.zone,
         d.languages, d.services, p.full_name, p.avatar_url,
         v.brand, v.model, v.color, v.photo_url,
         v.max_passengers, v.luggage_capacity,
         v.child_seat, v.chargers, v.water, v.pets_allowed, v.accessible
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
$$;

REVOKE ALL ON FUNCTION public.get_public_driver_page(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_driver_page(text) TO anon, authenticated;