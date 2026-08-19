-- ============================================================
-- 1. Identité légale de l'émetteur
-- ============================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS siren text,
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'FR',
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS billing_postal_code text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS vat_franchise boolean,
  ADD COLUMN IF NOT EXISTS vat_on_debits boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS entity_category text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS einvoicing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pa_provider text,
  ADD COLUMN IF NOT EXISTS pa_account_id text,
  ADD COLUMN IF NOT EXISTS pa_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS pa_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS einvoicing_address text,
  ADD COLUMN IF NOT EXISTS legal_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_entity_category_chk
  CHECK (entity_category IN ('unknown','micro','tpe','pme','eti','ge'));

ALTER TABLE public.companies
  ADD CONSTRAINT companies_pa_status_chk
  CHECK (pa_status IN ('none','pending','connected','error'));

-- SIREN déduit du SIRET existant lorsque c'est possible
UPDATE public.companies
   SET siren = left(regexp_replace(siret, '\D', '', 'g'), 9)
 WHERE siren IS NULL
   AND siret IS NOT NULL
   AND length(regexp_replace(siret, '\D', '', 'g')) >= 9;

-- ============================================================
-- 2. Contrôle SIREN (Luhn)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_valid_siren(_siren text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text; total int := 0; d int; i int;
BEGIN
  IF _siren IS NULL THEN RETURN true; END IF;
  s := regexp_replace(_siren, '\D', '', 'g');
  IF length(s) <> 9 THEN RETURN false; END IF;
  FOR i IN 1..9 LOOP
    d := substr(s, i, 1)::int;
    IF i % 2 = 0 THEN
      d := d * 2;
      IF d > 9 THEN d := d - 9; END IF;
    END IF;
    total := total + d;
  END LOOP;
  RETURN total % 10 = 0;
END;
$$;

-- ============================================================
-- 3. Clients facturés (distincts du passager)
-- ============================================================
CREATE TABLE public.billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'individual',
  display_name text NOT NULL,
  legal_name text,
  siren text,
  vat_number text,
  foreign_tax_id text,
  country_code text NOT NULL DEFAULT 'FR',
  address text,
  postal_code text,
  city text,
  billing_address text,
  billing_postal_code text,
  billing_city text,
  billing_email text,
  contact_name text,
  contact_phone text,
  po_number text,
  internal_ref text,
  einvoicing_address text,
  payment_terms text NOT NULL DEFAULT 'immediate',
  payment_terms_days int,
  address_opt_out boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_customers_kind_chk CHECK (kind IN ('individual','company_fr','company_foreign')),
  CONSTRAINT billing_customers_terms_chk CHECK (payment_terms IN ('immediate','on_receipt','net_days')),
  CONSTRAINT billing_customers_siren_chk CHECK (siren IS NULL OR public.is_valid_siren(siren)),
  CONSTRAINT billing_customers_fr_siren_chk CHECK (kind <> 'company_fr' OR siren IS NOT NULL OR archived_at IS NOT NULL)
);

CREATE INDEX billing_customers_driver_idx ON public.billing_customers(driver_id);
CREATE INDEX billing_customers_client_idx ON public.billing_customers(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_customers TO authenticated;
GRANT ALL ON public.billing_customers TO service_role;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Driver manages own billing customers"
  ON public.billing_customers FOR ALL TO authenticated
  USING (auth.uid() = driver_id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Client reads own billing identity"
  ON public.billing_customers FOR SELECT TO authenticated
  USING (auth.uid() = client_id);

CREATE TRIGGER billing_customers_updated_at
  BEFORE UPDATE ON public.billing_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. Statuts complémentaires
-- ============================================================
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'to_review';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'transmitted';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'received';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'partially_paid';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'credited';

-- ============================================================
-- 5. Factures : données réglementaires
-- ============================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.billing_customers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS customer_kind text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS customer_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS issuer_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS passenger_name text,
  ADD COLUMN IF NOT EXISTS service_date timestamptz,
  ADD COLUMN IF NOT EXISTS quantity numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit_price_ht numeric,
  ADD COLUMN IF NOT EXISTS discount_ht numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS operation_category text NOT NULL DEFAULT 'services',
  ADD COLUMN IF NOT EXISTS vat_on_debits boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_terms text NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS payment_terms_days int,
  ADD COLUMN IF NOT EXISTS late_penalty_applicable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recovery_fee_applicable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS po_number text,
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_due numeric,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS issued_number_year int,
  ADD COLUMN IF NOT EXISTS credit_note_of uuid REFERENCES public.invoices(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS replaced_by uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS routing_channel text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS transmission_status text NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS transmission_error text,
  ADD COLUMN IF NOT EXISTS transmitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS structured_format text,
  ADD COLUMN IF NOT EXISTS structured_path text,
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS document_hash text;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_document_type_chk CHECK (document_type IN ('invoice','credit_note'));
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_customer_kind_chk CHECK (customer_kind IN ('individual','company_fr','company_foreign'));
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_routing_chk CHECK (routing_channel IN ('none','portal','ereporting','manual_file'));
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_transmission_chk CHECK (transmission_status IN ('not_applicable','pending','sent','accepted','rejected','failed'));

ALTER TABLE public.invoices ALTER COLUMN number DROP NOT NULL;

UPDATE public.invoices
   SET amount_due = COALESCE(amount_ttc, 0) - COALESCE(amount_paid, 0),
       unit_price_ht = COALESCE(unit_price_ht, amount_ht),
       service_date = COALESCE(service_date, issued_on::timestamptz),
       issued_at = COALESCE(issued_at, CASE WHEN status <> 'draft' THEN created_at END),
       issued_number_year = COALESCE(issued_number_year, EXTRACT(YEAR FROM issued_on)::int);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_driver_number_uidx
  ON public.invoices(driver_id, number) WHERE number IS NOT NULL;

-- ============================================================
-- 6. Numérotation par chauffeur, sous verrou
-- ============================================================
CREATE TABLE public.invoice_counters (
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year int NOT NULL,
  document_type text NOT NULL DEFAULT 'invoice',
  last_number int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (driver_id, year, document_type)
);

GRANT SELECT ON public.invoice_counters TO authenticated;
GRANT ALL ON public.invoice_counters TO service_role;
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Driver reads own counters"
  ON public.invoice_counters FOR SELECT TO authenticated
  USING (auth.uid() = driver_id OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.next_invoice_number(_driver uuid, _year int, _type text DEFAULT 'invoice')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _seed int; _next int; _prefix text;
BEGIN
  _prefix := CASE WHEN _type = 'credit_note' THEN 'AV-' ELSE 'F-' END;

  INSERT INTO public.invoice_counters (driver_id, year, document_type, last_number)
  VALUES (_driver, _year, _type, 0)
  ON CONFLICT (driver_id, year, document_type) DO NOTHING;

  SELECT last_number INTO _next
    FROM public.invoice_counters
   WHERE driver_id = _driver AND year = _year AND document_type = _type
   FOR UPDATE;

  -- Reprise de l'historique : on ne réutilise jamais un numéro déjà émis
  IF _next = 0 THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(number, '^.*-', ''), '')::int), 0)
      INTO _seed
      FROM public.invoices
     WHERE driver_id = _driver
       AND number IS NOT NULL
       AND issued_number_year = _year
       AND document_type = _type;
    _next := GREATEST(_next, COALESCE(_seed, 0));
  END IF;

  _next := _next + 1;
  UPDATE public.invoice_counters
     SET last_number = _next, updated_at = now()
   WHERE driver_id = _driver AND year = _year AND document_type = _type;

  RETURN _prefix || _year::text || '-' || lpad(_next::text, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number(uuid, int, text) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 7. Journal de facturation
-- ============================================================
CREATE TABLE public.invoice_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL,
  actor_id uuid,
  event text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invoice_events_invoice_idx ON public.invoice_events(invoice_id, created_at DESC);

GRANT SELECT, INSERT ON public.invoice_events TO authenticated;
GRANT ALL ON public.invoice_events TO service_role;
ALTER TABLE public.invoice_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Driver reads own invoice events"
  ON public.invoice_events FOR SELECT TO authenticated
  USING (auth.uid() = driver_id OR public.is_admin(auth.uid()));

CREATE POLICY "Participants log invoice events"
  ON public.invoice_events FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.invoices i
       WHERE i.id = invoice_id
         AND i.driver_id = invoice_events.driver_id
         AND (i.driver_id = auth.uid() OR i.client_id = auth.uid())
    )
  );

-- ============================================================
-- 8. Encaissement réel
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_invoice_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv uuid; _total numeric; _ttc numeric; _status public.invoice_status;
BEGIN
  _inv := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount), 0) INTO _total FROM public.payments WHERE invoice_id = _inv;
  SELECT amount_ttc INTO _ttc FROM public.invoices WHERE id = _inv;

  _status := CASE
    WHEN _total <= 0 THEN NULL
    WHEN _total >= COALESCE(_ttc, 0) THEN 'paid'::public.invoice_status
    ELSE 'partially_paid'::public.invoice_status
  END;

  UPDATE public.invoices
     SET amount_paid = _total,
         amount_due = GREATEST(COALESCE(_ttc, 0) - _total, 0),
         paid_at = CASE WHEN _status = 'paid' THEN COALESCE(paid_at, now()) ELSE NULL END,
         status = CASE
           WHEN status IN ('draft','cancelled','credited') THEN status
           WHEN _status IS NULL THEN status
           ELSE _status END
   WHERE id = _inv;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS payments_recompute_invoice ON public.payments;
CREATE TRIGGER payments_recompute_invoice
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.recompute_invoice_payment();

-- ============================================================
-- 9. Immutabilité renforcée
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_invoice_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
    RAISE EXCEPTION 'driver_id cannot be changed';
  END IF;
  IF NEW.ride_id IS DISTINCT FROM OLD.ride_id THEN
    RAISE EXCEPTION 'ride_id cannot be changed';
  END IF;
  IF OLD.number IS NOT NULL AND NEW.number IS DISTINCT FROM OLD.number THEN
    RAISE EXCEPTION 'invoice number cannot be changed once issued';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    NEW.created_at := OLD.created_at;
  END IF;

  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.client_id IS DISTINCT FROM OLD.client_id AND OLD.status <> 'draft'::invoice_status THEN
    RAISE EXCEPTION 'client cannot be changed after issuance';
  END IF;

  IF OLD.status <> 'draft'::invoice_status AND (
       NEW.amount_ht IS DISTINCT FROM OLD.amount_ht
    OR NEW.amount_ttc IS DISTINCT FROM OLD.amount_ttc
    OR NEW.vat_rate IS DISTINCT FROM OLD.vat_rate
    OR NEW.issued_on IS DISTINCT FROM OLD.issued_on
    OR NEW.quantity IS DISTINCT FROM OLD.quantity
    OR NEW.unit_price_ht IS DISTINCT FROM OLD.unit_price_ht
    OR NEW.customer_snapshot IS DISTINCT FROM OLD.customer_snapshot
    OR NEW.issuer_snapshot IS DISTINCT FROM OLD.issuer_snapshot
    OR NEW.tax_regime IS DISTINCT FROM OLD.tax_regime
    OR NEW.tax_vat_number IS DISTINCT FROM OLD.tax_vat_number
    OR NEW.tax_legal_mention IS DISTINCT FROM OLD.tax_legal_mention
  ) THEN
    RAISE EXCEPTION 'les données d''une facture émise ne peuvent plus être modifiées : utilisez un avoir';
  END IF;

  IF OLD.status IN ('cancelled'::invoice_status, 'credited'::invoice_status)
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'invoice status is final';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_invoice_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.number IS NOT NULL OR OLD.status <> 'draft'::invoice_status THEN
    RAISE EXCEPTION 'une facture émise ne peut pas être supprimée';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS invoices_guard_delete ON public.invoices;
CREATE TRIGGER invoices_guard_delete
  BEFORE DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_delete();

-- ============================================================
-- 10. Facture auto de fin de course : brouillon sans numéro
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_ride_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _regime text; _rate numeric; _ht numeric; _vat numeric; _ttc numeric;
  _mention text; _vatnum text; _tax record; _passenger text;
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

  IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE ride_id = NEW.id) THEN
    INSERT INTO public.invoices (
      ride_id, driver_id, client_id, number, issued_on, description,
      amount_ht, vat_rate, amount_ttc, status, payment_method, auto_generated,
      tax_regime, tax_legal_mention, tax_vat_number,
      quantity, unit_price_ht, amount_due, service_date, passenger_name,
      customer_kind, document_type
    ) VALUES (
      NEW.id, NEW.driver_id, NEW.client_id, NULL, COALESCE(NEW.completed_at, now())::date,
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
$$;
