ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS working_hours jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.get_public_driver_hours(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(dp.working_hours, '[]'::jsonb)
  FROM public.driver_profiles dp
  WHERE dp.slug = _slug
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_driver_working_hours(_ids uuid[])
RETURNS TABLE(user_id uuid, working_hours jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dp.user_id, COALESCE(dp.working_hours, '[]'::jsonb)
  FROM public.driver_profiles dp
  WHERE dp.user_id = ANY(_ids)
$$;

REVOKE ALL ON FUNCTION public.get_public_driver_hours(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_driver_working_hours(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_driver_hours(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_driver_working_hours(uuid[]) TO authenticated, service_role;