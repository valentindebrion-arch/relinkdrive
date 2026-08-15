DROP POLICY IF EXISTS rides_update ON public.rides;
CREATE POLICY rides_update ON public.rides FOR UPDATE TO authenticated
USING ((driver_id = auth.uid()) OR is_admin(auth.uid()))
WITH CHECK ((driver_id = auth.uid()) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS inv_update_driver ON public.invoices;
CREATE POLICY inv_update_driver ON public.invoices FOR UPDATE TO authenticated
USING ((driver_id = auth.uid()) OR is_admin(auth.uid()))
WITH CHECK ((((driver_id = auth.uid()) AND ((client_id IS NULL) OR is_connected(client_id, auth.uid()))) OR is_admin(auth.uid())));