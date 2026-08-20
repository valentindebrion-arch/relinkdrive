CREATE OR REPLACE FUNCTION public.driver_supports_scheduled(_driver uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.driver_plan(_driver) = 'pro';
$$;

REVOKE ALL ON FUNCTION public.driver_supports_scheduled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_supports_scheduled(uuid) TO authenticated, service_role;