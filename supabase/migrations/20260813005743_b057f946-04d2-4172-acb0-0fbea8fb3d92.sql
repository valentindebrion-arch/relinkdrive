CREATE OR REPLACE FUNCTION public.sync_ride_tax_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _req record;
  _tax record;
  _ttc numeric;
  _rate numeric;
BEGIN
  IF NEW.is_block THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.price IS NOT DISTINCT FROM OLD.price
     AND NEW.tax_regime IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.tax_regime IS NULL THEN
    IF NEW.request_id IS NOT NULL THEN
      SELECT r.tax_regime, r.tax_vat_rate, r.tax_vat_number, r.tax_legal_name,
             r.tax_legal_mention, r.tax_effective_from
        INTO _req
      FROM public.ride_requests r WHERE r.id = NEW.request_id;
    END IF;

    IF _req.tax_regime IS NOT NULL THEN
      NEW.tax_regime := _req.tax_regime;
      NEW.tax_vat_rate := _req.tax_vat_rate;
      NEW.tax_vat_number := _req.tax_vat_number;
      NEW.tax_legal_name := _req.tax_legal_name;
      NEW.tax_legal_mention := _req.tax_legal_mention;
      NEW.tax_effective_from := _req.tax_effective_from;
    ELSE
      SELECT * INTO _tax
      FROM public.driver_tax_at(NEW.driver_id, COALESCE(NEW.scheduled_at, now())::date);
      NEW.tax_regime := COALESCE(_tax.regime, 'franchise');
      NEW.tax_vat_rate := _tax.vat_rate;
      NEW.tax_vat_number := _tax.vat_number;
      NEW.tax_legal_mention := COALESCE(_tax.legal_mention, 'TVA non applicable, art. 293 B du CGI');
      NEW.tax_effective_from := _tax.effective_from;
      SELECT COALESCE(c.legal_name, d.business_name, p.full_name) INTO NEW.tax_legal_name
      FROM public.driver_profiles d
      JOIN public.profiles p ON p.id = d.user_id
      LEFT JOIN public.companies c ON c.driver_id = d.user_id
      WHERE d.user_id = NEW.driver_id;
    END IF;
  END IF;

  -- Ventilation a partir du montant reellement payable (TTC), avec le regime fige.
  _ttc := NEW.price;
  _rate := CASE WHEN NEW.tax_regime = 'liable' THEN NEW.tax_vat_rate END;

  IF _ttc IS NULL THEN
    NEW.amount_ht := NULL; NEW.vat_amount := NULL; NEW.amount_ttc := NULL;
  ELSIF _rate IS NOT NULL THEN
    NEW.amount_ht := round(_ttc / (1 + _rate / 100), 2);
    NEW.vat_amount := round(_ttc - round(_ttc / (1 + _rate / 100), 2), 2);
    NEW.amount_ttc := round(_ttc, 2);
  ELSE
    NEW.amount_ht := round(_ttc, 2);
    NEW.vat_amount := NULL;
    NEW.amount_ttc := round(_ttc, 2);
  END IF;

  NEW.tax_computed_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS rides_tax_snapshot ON public.rides;
CREATE TRIGGER rides_tax_snapshot
  BEFORE INSERT OR UPDATE OF price ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.sync_ride_tax_snapshot();