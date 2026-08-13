
-- 1) Add WITH CHECK to rides update policy
DROP POLICY IF EXISTS "rides_update" ON public.rides;
CREATE POLICY "rides_update" ON public.rides
FOR UPDATE
USING (driver_id = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (driver_id = auth.uid() OR public.is_admin(auth.uid()));

-- 2) Guard immutable ride columns
CREATE OR REPLACE FUNCTION public.guard_ride_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
    RAISE EXCEPTION 'driver_id cannot be changed';
  END IF;
  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'client_id cannot be changed';
  END IF;
  IF NEW.request_id IS DISTINCT FROM OLD.request_id THEN
    RAISE EXCEPTION 'request_id cannot be changed';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ride_update ON public.rides;
CREATE TRIGGER trg_guard_ride_update
BEFORE UPDATE ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.guard_ride_update();

-- 3) Add WITH CHECK to invoices update policy
DROP POLICY IF EXISTS "inv_update_driver" ON public.invoices;
CREATE POLICY "inv_update_driver" ON public.invoices
FOR UPDATE
USING (driver_id = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (
  (driver_id = auth.uid() AND (client_id IS NULL OR public.is_connected(client_id, auth.uid())))
  OR public.is_admin(auth.uid())
);

-- 4) Guard invoice financial/ownership fields
CREATE OR REPLACE FUNCTION public.guard_invoice_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
    RAISE EXCEPTION 'driver_id cannot be changed';
  END IF;
  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'client_id cannot be changed';
  END IF;
  IF NEW.ride_id IS DISTINCT FROM OLD.ride_id THEN
    RAISE EXCEPTION 'ride_id cannot be changed';
  END IF;
  IF NEW.number IS DISTINCT FROM OLD.number THEN
    RAISE EXCEPTION 'invoice number cannot be changed';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    NEW.created_at := OLD.created_at;
  END IF;

  -- Financial fields are frozen once the invoice is no longer a draft
  IF OLD.status <> 'draft'::invoice_status AND (
       NEW.amount_ht IS DISTINCT FROM OLD.amount_ht
    OR NEW.amount_ttc IS DISTINCT FROM OLD.amount_ttc
    OR NEW.vat_rate IS DISTINCT FROM OLD.vat_rate
    OR NEW.issued_on IS DISTINCT FROM OLD.issued_on
    OR NEW.tax_regime IS DISTINCT FROM OLD.tax_regime
    OR NEW.tax_vat_number IS DISTINCT FROM OLD.tax_vat_number
    OR NEW.tax_legal_mention IS DISTINCT FROM OLD.tax_legal_mention
  ) THEN
    RAISE EXCEPTION 'financial fields cannot be changed after issuance';
  END IF;

  -- A paid or cancelled invoice cannot be reopened by a driver
  IF OLD.status IN ('paid'::invoice_status, 'cancelled'::invoice_status)
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'invoice status is final';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_invoice_update ON public.invoices;
CREATE TRIGGER trg_guard_invoice_update
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_update();
