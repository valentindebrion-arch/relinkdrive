DROP POLICY IF EXISTS req_update ON public.ride_requests;

CREATE POLICY req_update ON public.ride_requests
FOR UPDATE
TO authenticated
USING (
  client_id = auth.uid()
  OR driver_id = auth.uid()
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  client_id = auth.uid()
  OR driver_id = auth.uid()
  OR public.is_admin(auth.uid())
);