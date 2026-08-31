CREATE OR REPLACE FUNCTION public.get_driver_themes(_ids uuid[])
RETURNS TABLE (user_id uuid, booking_theme text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dp.user_id, COALESCE(dp.booking_theme, 'relink_classic')::text
  FROM public.driver_profiles dp
  WHERE dp.user_id = ANY(COALESCE(_ids, '{}'::uuid[]))
$$;

REVOKE ALL ON FUNCTION public.get_driver_themes(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_driver_themes(uuid[]) TO anon, authenticated, service_role;