DROP POLICY IF EXISTS "audit_insert" ON public.audit_logs;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated;

DROP POLICY IF EXISTS "Participants log invoice events" ON public.invoice_events;
CREATE POLICY "Driver logs own invoice events" ON public.invoice_events
FOR INSERT TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND driver_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_events.invoice_id
      AND i.driver_id = auth.uid()
  )
);

REVOKE INSERT, UPDATE, DELETE ON public.driver_plan_changes FROM authenticated;