DROP POLICY IF EXISTS audit_insert ON public.audit_logs;
CREATE POLICY audit_insert ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) AND actor_id = auth.uid());

DROP POLICY IF EXISTS inv_insert_driver ON public.invoices;
CREATE POLICY inv_insert_driver ON public.invoices
FOR INSERT TO authenticated
WITH CHECK (
  driver_id = auth.uid()
  AND (client_id IS NULL OR public.is_connected(client_id, auth.uid()))
);