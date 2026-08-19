-- Émission d'une facture : contrôles, figeage des identités, numérotation
CREATE OR REPLACE FUNCTION public.issue_invoice(_invoice_id uuid)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.invoices;
  _co public.companies;
  _cu public.billing_customers;
  _dp record;
  _year int;
  _num text;
  _due date;
  _b2b boolean;
BEGIN
  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id FOR UPDATE;
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'Facture introuvable'; END IF;
  IF _inv.driver_id <> auth.uid() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF _inv.number IS NOT NULL THEN RAISE EXCEPTION 'Cette facture est déjà émise'; END IF;

  SELECT * INTO _co FROM public.companies WHERE driver_id = _inv.driver_id;
  SELECT user_id, business_name, siret, vtc_card_number, professional_address, billing_legal_info,
         public_phone
    INTO _dp
    FROM public.driver_profiles WHERE user_id = _inv.driver_id;

  IF _co.id IS NULL OR COALESCE(_co.legal_name, '') = '' THEN
    RAISE EXCEPTION 'Complétez la raison sociale de votre entreprise avant d''émettre une facture';
  END IF;
  IF _co.siren IS NULL OR NOT public.is_valid_siren(_co.siren) THEN
    RAISE EXCEPTION 'Renseignez un SIREN valide dans votre fiche entreprise';
  END IF;
  IF COALESCE(_co.billing_address, _co.address) IS NULL THEN
    RAISE EXCEPTION 'Renseignez l''adresse de votre entreprise';
  END IF;
  IF _inv.customer_id IS NULL THEN
    RAISE EXCEPTION 'Sélectionnez le client à facturer';
  END IF;
  IF COALESCE(_inv.amount_ttc, 0) <= 0 AND _inv.document_type = 'invoice' THEN
    RAISE EXCEPTION 'Le montant de la facture doit être supérieur à zéro';
  END IF;
  IF _inv.service_date IS NULL THEN
    RAISE EXCEPTION 'Indiquez la date de la prestation';
  END IF;

  SELECT * INTO _cu FROM public.billing_customers WHERE id = _inv.customer_id;
  IF _cu.driver_id <> _inv.driver_id THEN RAISE EXCEPTION 'Client invalide'; END IF;
  IF _cu.kind = 'company_fr' AND (_cu.siren IS NULL OR NOT public.is_valid_siren(_cu.siren)) THEN
    RAISE EXCEPTION 'Le SIREN du client professionnel français est obligatoire et doit être valide';
  END IF;

  _b2b := _cu.kind <> 'individual';
  _year := EXTRACT(YEAR FROM COALESCE(_inv.issued_on, current_date))::int;
  _num := public.next_invoice_number(_inv.driver_id, _year, _inv.document_type);

  _due := CASE
    WHEN _cu.payment_terms = 'net_days' AND _cu.payment_terms_days IS NOT NULL
      THEN COALESCE(_inv.issued_on, current_date) + _cu.payment_terms_days
    ELSE COALESCE(_inv.issued_on, current_date)
  END;

  UPDATE public.invoices SET
    number = _num,
    issued_number_year = _year,
    issued_on = COALESCE(issued_on, current_date),
    issued_at = now(),
    status = 'issued'::public.invoice_status,
    customer_kind = _cu.kind,
    client_id = COALESCE(client_id, _cu.client_id),
    payment_terms = _cu.payment_terms,
    payment_terms_days = _cu.payment_terms_days,
    due_on = _due,
    late_penalty_applicable = _b2b,
    recovery_fee_applicable = _b2b,
    po_number = COALESCE(po_number, _cu.po_number),
    vat_on_debits = COALESCE(_co.vat_on_debits, false),
    amount_due = GREATEST(COALESCE(amount_ttc, 0) - COALESCE(amount_paid, 0), 0),
    routing_channel = CASE WHEN _b2b THEN 'manual_file' ELSE 'ereporting' END,
    transmission_status = 'pending',
    issuer_snapshot = jsonb_build_object(
      'legal_name', _co.legal_name, 'legal_form', _co.legal_form,
      'siren', _co.siren, 'siret', _co.siret,
      'vat_number', _co.vat_number, 'country_code', _co.country_code,
      'address', COALESCE(_co.billing_address, _co.address),
      'postal_code', COALESCE(_co.billing_postal_code, _co.postal_code),
      'city', COALESCE(_co.billing_city, _co.city),
      'email', _co.contact_email, 'phone', COALESCE(_co.contact_phone, _dp.public_phone),
      'trade_name', _dp.business_name, 'vtc_card_number', _dp.vtc_card_number,
      'vat_on_debits', COALESCE(_co.vat_on_debits, false)
    ),
    customer_snapshot = jsonb_build_object(
      'kind', _cu.kind, 'display_name', _cu.display_name, 'legal_name', _cu.legal_name,
      'siren', _cu.siren, 'vat_number', _cu.vat_number, 'foreign_tax_id', _cu.foreign_tax_id,
      'country_code', _cu.country_code,
      'address', COALESCE(_cu.billing_address, _cu.address),
      'postal_code', COALESCE(_cu.billing_postal_code, _cu.postal_code),
      'city', COALESCE(_cu.billing_city, _cu.city),
      'email', _cu.billing_email, 'phone', _cu.contact_phone,
      'po_number', _cu.po_number, 'internal_ref', _cu.internal_ref,
      'address_opt_out', _cu.address_opt_out
    )
  WHERE id = _invoice_id
  RETURNING * INTO _inv;

  INSERT INTO public.invoice_events (invoice_id, driver_id, actor_id, event, detail)
  VALUES (_invoice_id, _inv.driver_id, auth.uid(), 'issued',
          jsonb_build_object('number', _num, 'amount_ttc', _inv.amount_ttc));

  RETURN _inv;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_invoice(uuid) TO authenticated;

-- Avoir rattaché à une facture émise
CREATE OR REPLACE FUNCTION public.create_credit_note(_invoice_id uuid, _reason text, _amount_ttc numeric DEFAULT NULL)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _src public.invoices;
  _new public.invoices;
  _ttc numeric; _ht numeric; _vat numeric; _rate numeric;
BEGIN
  SELECT * INTO _src FROM public.invoices WHERE id = _invoice_id FOR UPDATE;
  IF _src.id IS NULL THEN RAISE EXCEPTION 'Facture introuvable'; END IF;
  IF _src.driver_id <> auth.uid() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF _src.number IS NULL THEN RAISE EXCEPTION 'Un brouillon se corrige directement, sans avoir'; END IF;
  IF _src.document_type <> 'invoice' THEN RAISE EXCEPTION 'Un avoir ne peut pas être corrigé par un avoir'; END IF;
  IF COALESCE(trim(_reason), '') = '' THEN RAISE EXCEPTION 'Le motif de l''avoir est obligatoire'; END IF;

  _ttc := LEAST(COALESCE(_amount_ttc, _src.amount_ttc), _src.amount_ttc);
  IF _ttc <= 0 THEN RAISE EXCEPTION 'Le montant de l''avoir doit être supérieur à zéro'; END IF;
  _rate := _src.vat_rate;
  IF _src.tax_regime = 'liable' AND COALESCE(_rate, 0) > 0 THEN
    _ht := round(_ttc / (1 + _rate / 100), 2);
    _vat := round(_ttc - _ht, 2);
  ELSE
    _ht := _ttc; _vat := 0;
  END IF;

  INSERT INTO public.invoices (
    ride_id, driver_id, client_id, customer_id, customer_kind, customer_snapshot, issuer_snapshot,
    number, issued_on, description, amount_ht, vat_rate, amount_ttc, status, document_type,
    credit_note_of, tax_regime, tax_legal_mention, tax_vat_number, quantity, unit_price_ht,
    service_date, passenger_name, currency, amount_due, auto_generated
  ) VALUES (
    _src.ride_id, _src.driver_id, _src.client_id, _src.customer_id, _src.customer_kind,
    _src.customer_snapshot, _src.issuer_snapshot,
    public.next_invoice_number(_src.driver_id, EXTRACT(YEAR FROM current_date)::int, 'credit_note'),
    current_date,
    'Avoir sur la facture ' || _src.number || ' — ' || _reason,
    -_ht, COALESCE(_rate, 0), -_ttc, 'issued'::public.invoice_status, 'credit_note',
    _src.id, _src.tax_regime, _src.tax_legal_mention, _src.tax_vat_number, 1, -_ht,
    _src.service_date, _src.passenger_name, _src.currency, 0, false
  ) RETURNING * INTO _new;

  UPDATE public.invoices
     SET issued_number_year = EXTRACT(YEAR FROM current_date)::int,
         issued_at = now()
   WHERE id = _new.id;

  IF _ttc >= _src.amount_ttc THEN
    UPDATE public.invoices SET status = 'credited'::public.invoice_status, replaced_by = _new.id
     WHERE id = _src.id;
  END IF;

  INSERT INTO public.invoice_events (invoice_id, driver_id, actor_id, event, detail)
  VALUES (_src.id, _src.driver_id, auth.uid(), 'credit_note_created',
          jsonb_build_object('credit_note_id', _new.id, 'amount_ttc', _ttc, 'reason', _reason));

  RETURN _new;
END;
$$;

REVOKE ALL ON FUNCTION public.create_credit_note(uuid, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_credit_note(uuid, text, numeric) TO authenticated;

-- Encaissement explicite
CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  _invoice_id uuid, _amount numeric, _method text, _paid_at timestamptz DEFAULT now(), _note text DEFAULT NULL
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.invoices;
BEGIN
  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id FOR UPDATE;
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'Facture introuvable'; END IF;
  IF _inv.driver_id <> auth.uid() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF _inv.number IS NULL THEN RAISE EXCEPTION 'Émettez la facture avant d''enregistrer un règlement'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  IF COALESCE(_inv.amount_paid, 0) + _amount > COALESCE(_inv.amount_ttc, 0) + 0.009 THEN
    RAISE EXCEPTION 'Le total encaissé dépasserait le montant de la facture';
  END IF;

  INSERT INTO public.payments (invoice_id, driver_id, client_id, amount, method, paid_at, note)
  VALUES (_invoice_id, _inv.driver_id, _inv.client_id, _amount, _method, _paid_at, _note);

  INSERT INTO public.invoice_events (invoice_id, driver_id, actor_id, event, detail)
  VALUES (_invoice_id, _inv.driver_id, auth.uid(), 'payment_recorded',
          jsonb_build_object('amount', _amount, 'method', _method, 'paid_at', _paid_at));

  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id;
  RETURN _inv;
END;
$$;

REVOKE ALL ON FUNCTION public.record_invoice_payment(uuid, numeric, text, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(uuid, numeric, text, timestamptz, text) TO authenticated;