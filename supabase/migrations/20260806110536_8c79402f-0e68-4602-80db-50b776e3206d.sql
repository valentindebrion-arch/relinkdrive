CREATE OR REPLACE FUNCTION public.is_verified_driver(_driver uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.driver_profiles d
    WHERE d.user_id = _driver AND d.verification_status = 'verified'
  );
$$;

REVOKE ALL ON FUNCTION public.is_verified_driver(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_verified_driver(uuid) TO authenticated;

DROP POLICY IF EXISTS conn_insert_client ON public.driver_client_connections;
CREATE POLICY conn_insert_client ON public.driver_client_connections
FOR INSERT TO authenticated
WITH CHECK (client_id = auth.uid() AND public.is_verified_driver(driver_id));