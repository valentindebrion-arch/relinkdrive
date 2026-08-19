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
      'vat_on_debits', COALESCE(_co.vat_on_debits, false),
      'einvoicing_address', _co.einvoicing_address,
      'pa_provider', _co.pa_provider,
      'entity_category', _co.entity_category
    ),
    customer_snapshot = jsonb_build_object(
      'kind', _cu.kind, 'display_name', _cu.display_name, 'legal_name', _cu.legal_name,
      'siren', _cu.siren, 'vat_number', _cu.vat_number, 'foreign_tax_id', _cu.foreign_tax_id,
      'country_code', _cu.country_code,
      'address', COALESCE(_cu.billing_address, _cu.address),
      'postal_code', COALESCE(_cu.billing_postal_code, _cu.postal_code),
      'city', COALESCE(_cu.billing_city, _cu.city),
      'email', _cu.billing_email, 'phone', _cu.contact_phone,
      'accounting_email', _cu.accounting_email,
      'po_number', _cu.po_number, 'internal_ref', _cu.internal_ref,
      'address_opt_out', _cu.address_opt_out,
      'einvoicing_address', _cu.einvoicing_address,
      'routing_id', _cu.routing_id,
      'routing_scheme', _cu.routing_scheme,
      'recipient_platform', _cu.recipient_platform,
      'siren_check_status', _cu.siren_check_status,
      'payment_terms', _cu.payment_terms,
      'payment_terms_days', _cu.payment_terms_days
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