DROP POLICY IF EXISTS conn_insert_client ON public.driver_client_connections;
CREATE POLICY conn_insert_client
ON public.driver_client_connections
FOR INSERT
TO authenticated
WITH CHECK (
  client_id = auth.uid()
  AND client_id <> driver_id
  AND public.has_role(auth.uid(), 'client'::public.app_role)
  AND NOT public.has_role(auth.uid(), 'driver'::public.app_role)
  AND NOT public.is_admin(auth.uid())
  AND public.is_verified_driver(driver_id)
);