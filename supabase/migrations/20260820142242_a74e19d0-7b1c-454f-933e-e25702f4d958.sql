CREATE OR REPLACE FUNCTION public.on_ride_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _regime text; _rate numeric; _ht numeric; _vat numeric; _ttc numeric;
  _mention text; _vatnum text; _tax record; _passenger text; _cust uuid;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' OR NEW.is_block THEN
    RETURN NEW;
  END IF;

  _regime := NEW.tax_regime; _rate := NEW.tax_vat_rate;
  _ht := NEW.amount_ht; _vat := NEW.vat_amount; _ttc := NEW.amount_ttc;
  _mention := NEW.tax_legal_mention; _vatnum := NEW.tax_vat_number;

  IF _ttc IS NULL THEN
    SELECT * INTO _tax FROM public.driver_tax_at(NEW.driver_id, COALESCE(NEW.completed_at, now())::date);
    _regime := COALESCE(_tax.regime, 'franchise');
    _mention := COALESCE(_tax.legal_mention, 'TVA non applicable, art. 293 B du CGI');
    _vatnum := _tax.vat_number;
    _ttc := COALESCE(NEW.price, 0);
    IF _regime = 'liable' AND _tax.vat_rate IS NOT NULL THEN
      _rate := _tax.vat_rate;
      _ht := round(_ttc / (1 + _rate / 100), 2);
      _vat := round(_ttc - _ht, 2);
    ELSE
      _rate := NULL; _ht := _ttc; _vat := NULL;
    END IF;
  END IF;

  SELECT COALESCE(p.full_name, NEW.client_label) INTO _passenger
    FROM public.profiles p WHERE p.id = NEW.client_id;

  -- Client facturé : réutilise la fiche du chauffeur, sinon la crée depuis le profil.
  IF NEW.client_id IS NOT NULL THEN
    SELECT id INTO _cust
      FROM public.billing_customers
     WHERE driver_id = NEW.driver_id AND client_id = NEW.client_id AND archived_at IS NULL
     ORDER BY created_at
     LIMIT 1;
    IF _cust IS NULL THEN
      INSERT INTO public.billing_customers (driver_id, client_id, kind, display_name, billing_email, contact_phone)
      SELECT NEW.driver_id, NEW.client_id, 'individual',
             COALESCE(NULLIF(p.full_name, ''), NEW.client_label, 'Client'), p.email, p.phone
        FROM public.profiles p WHERE p.id = NEW.client_id
      RETURNING id INTO _cust;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE ride_id = NEW.id) THEN
    INSERT INTO public.invoices (
      ride_id, driver_id, client_id, customer_id, number, issued_on, description,
      amount_ht, vat_rate, amount_ttc, status, payment_method, auto_generated,
      tax_regime, tax_legal_mention, tax_vat_number,
      quantity, unit_price_ht, amount_due, service_date, passenger_name,
      customer_kind, document_type
    ) VALUES (
      NEW.id, NEW.driver_id, NEW.client_id, _cust, NULL, COALESCE(NEW.completed_at, now())::date,
      'Prestation de transport VTC du ' ||
        to_char(COALESCE(NEW.completed_at, NEW.scheduled_at), 'DD/MM/YYYY'),
      COALESCE(_ht, 0), COALESCE(_rate, 0), COALESCE(_ttc, 0),
      'draft'::public.invoice_status, NEW.payment_method, true,
      _regime, _mention, _vatnum,
      1, COALESCE(_ht, 0), COALESCE(_ttc, 0),
      COALESCE(NEW.completed_at, NEW.scheduled_at), COALESCE(_passenger, NEW.client_label),
      'individual', 'invoice'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Verrouillage des données issues de la course sur un brouillon : seul le
-- client facturé (et le cycle de vie géré par issue_invoice) peut changer.
CREATE OR REPLACE FUNCTION public.guard_ride_invoice_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.ride_id IS NULL OR OLD.status <> 'draft'::invoice_status THEN
    RETURN NEW;
  END IF;
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.amount_ht IS DISTINCT FROM OLD.amount_ht
     OR NEW.amount_ttc IS DISTINCT FROM OLD.amount_ttc
     OR NEW.vat_rate IS DISTINCT FROM OLD.vat_rate
     OR NEW.quantity IS DISTINCT FROM OLD.quantity
     OR NEW.unit_price_ht IS DISTINCT FROM OLD.unit_price_ht
     OR NEW.service_date IS DISTINCT FROM OLD.service_date
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.passenger_name IS DISTINCT FROM OLD.passenger_name
     OR NEW.tax_regime IS DISTINCT FROM OLD.tax_regime
     OR NEW.tax_vat_number IS DISTINCT FROM OLD.tax_vat_number
     OR NEW.tax_legal_mention IS DISTINCT FROM OLD.tax_legal_mention THEN
    RAISE EXCEPTION 'les informations issues de la course ne peuvent pas être modifiées';
  END IF;
  IF NEW.customer_id IS NOT NULL AND NEW.customer_id IS DISTINCT FROM OLD.customer_id
     AND NOT EXISTS (
       SELECT 1 FROM public.billing_customers
        WHERE id = NEW.customer_id AND driver_id = OLD.driver_id AND archived_at IS NULL
     ) THEN
    RAISE EXCEPTION 'Client facturé invalide';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_ride_invoice_draft ON public.invoices;
CREATE TRIGGER trg_guard_ride_invoice_draft
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_ride_invoice_draft();

-- Rattachement rétroactif des brouillons existants issus d'une course.
INSERT INTO public.billing_customers (driver_id, client_id, kind, display_name, billing_email, contact_phone)
SELECT DISTINCT ON (i.driver_id, i.client_id)
       i.driver_id, i.client_id, 'individual',
       COALESCE(NULLIF(p.full_name, ''), 'Client'), p.email, p.phone
  FROM public.invoices i
  JOIN public.profiles p ON p.id = i.client_id
 WHERE i.status = 'draft'::invoice_status
   AND i.ride_id IS NOT NULL
   AND i.customer_id IS NULL
   AND i.client_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.billing_customers bc
      WHERE bc.driver_id = i.driver_id AND bc.client_id = i.client_id AND bc.archived_at IS NULL
   );

UPDATE public.invoices i
   SET customer_id = bc.id
  FROM public.billing_customers bc
 WHERE i.customer_id IS NULL
   AND i.status = 'draft'::invoice_status
   AND i.ride_id IS NOT NULL
   AND bc.driver_id = i.driver_id
   AND bc.client_id = i.client_id
   AND bc.archived_at IS NULL;