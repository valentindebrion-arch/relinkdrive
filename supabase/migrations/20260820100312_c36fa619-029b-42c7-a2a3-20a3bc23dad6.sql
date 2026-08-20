DROP POLICY IF EXISTS "Driver manages own billing customers" ON public.billing_customers;

CREATE POLICY "billing_customers_select" ON public.billing_customers
FOR SELECT TO authenticated
USING (auth.uid() = driver_id OR public.is_admin(auth.uid()));

CREATE POLICY "billing_customers_insert" ON public.billing_customers
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "billing_customers_update" ON public.billing_customers
FOR UPDATE TO authenticated
USING (auth.uid() = driver_id)
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "billing_customers_delete" ON public.billing_customers
FOR DELETE TO authenticated
USING (auth.uid() = driver_id);