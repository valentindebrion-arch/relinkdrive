
-- =============================================================
-- Lot 2 : plateforme agréée, transmissions, e-reporting, réception
-- =============================================================

-- 1. Connexions à une plateforme agréée -----------------------------------
CREATE TABLE public.e_invoicing_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  provider_key text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  external_account_id text,
  electronic_billing_address text,
  connection_status text NOT NULL DEFAULT 'not_connected'
    CHECK (connection_status IN ('not_connected','pending','connected','expired','error')),
  reception_enabled boolean NOT NULL DEFAULT false,
  emission_enabled boolean NOT NULL DEFAULT false,
  transaction_reporting_enabled boolean NOT NULL DEFAULT false,
  payment_reporting_enabled boolean NOT NULL DEFAULT false,
  auto_reporting_enabled boolean NOT NULL DEFAULT false,
  credentials_reference text,
  last_error_message text,
  connected_at timestamptz,
  last_verified_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, provider_key, environment)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.e_invoicing_connections TO authenticated;
GRANT ALL ON public.e_invoicing_connections TO service_role;
ALTER TABLE public.e_invoicing_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conn_driver_all" ON public.e_invoicing_connections
  FOR ALL TO authenticated USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "conn_admin_read" ON public.e_invoicing_connections
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_conn_updated BEFORE UPDATE ON public.e_invoicing_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Transmissions de factures --------------------------------------------
CREATE TABLE public.invoice_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  external_submission_id text,
  recipient_routing_id text,
  submitted_format text NOT NULL DEFAULT 'facturx_en16931',
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('not_ready','ready','validation_failed','awaiting_confirmation','queued',
                      'submitted','acknowledged','delivered','rejected','technical_error',
                      'cancelled_before_submission')),
  attempt_number integer NOT NULL DEFAULT 1,
  idempotency_key text NOT NULL,
  submitted_at timestamptz,
  acknowledged_at timestamptz,
  delivered_at timestamptz,
  rejected_at timestamptz,
  last_error_code text,
  last_error_message text,
  receipt_storage_path text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);

GRANT SELECT, INSERT, UPDATE ON public.invoice_submissions TO authenticated;
GRANT ALL ON public.invoice_submissions TO service_role;
ALTER TABLE public.invoice_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_driver_read" ON public.invoice_submissions
  FOR SELECT TO authenticated USING (auth.uid() = driver_id OR public.is_admin(auth.uid()));
CREATE POLICY "sub_driver_insert" ON public.invoice_submissions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "sub_driver_update" ON public.invoice_submissions
  FOR UPDATE TO authenticated USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);

CREATE TRIGGER trg_sub_updated BEFORE UPDATE ON public.invoice_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_invoice_submissions_invoice ON public.invoice_submissions(invoice_id);
CREATE INDEX idx_invoice_submissions_driver ON public.invoice_submissions(driver_id, status);

-- 3. Événements de transmission (immuables) --------------------------------
CREATE TABLE public.invoice_submission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.invoice_submissions(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_event_id text,
  event_type text NOT NULL,
  event_date timestamptz NOT NULL DEFAULT now(),
  payload_hash text,
  payload_storage_path text,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.invoice_submission_events TO authenticated;
GRANT ALL ON public.invoice_submission_events TO service_role;
ALTER TABLE public.invoice_submission_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subev_read" ON public.invoice_submission_events
  FOR SELECT TO authenticated USING (auth.uid() = driver_id OR public.is_admin(auth.uid()));
CREATE POLICY "subev_insert" ON public.invoice_submission_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = driver_id);

CREATE INDEX idx_submission_events_submission ON public.invoice_submission_events(submission_id);

-- 4. Périodes d'e-reporting -------------------------------------------------
CREATE TABLE public.ereporting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('transaction','payment')),
  frequency text NOT NULL CHECK (frequency IN ('daily','decadal','monthly','quarterly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  due_on date,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','ready','validation_failed','awaiting_confirmation','submitted',
                      'acknowledged','rejected','corrected')),
  transaction_count integer NOT NULL DEFAULT 0,
  total_ht numeric NOT NULL DEFAULT 0,
  total_vat numeric NOT NULL DEFAULT 0,
  total_ttc numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  aggregates jsonb,
  provider_key text,
  environment text,
  external_submission_id text,
  submitted_at timestamptz,
  acknowledged_at timestamptz,
  rejected_at timestamptz,
  last_error_message text,
  receipt_storage_path text,
  auto_submitted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, kind, period_start, period_end)
);

GRANT SELECT, INSERT, UPDATE ON public.ereporting_periods TO authenticated;
GRANT ALL ON public.ereporting_periods TO service_role;
ALTER TABLE public.ereporting_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_read" ON public.ereporting_periods
  FOR SELECT TO authenticated USING (auth.uid() = driver_id OR public.is_admin(auth.uid()));
CREATE POLICY "erp_insert" ON public.ereporting_periods
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "erp_update" ON public.ereporting_periods
  FOR UPDATE TO authenticated USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);

CREATE TRIGGER trg_erp_updated BEFORE UPDATE ON public.ereporting_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Transactions rattachées à une période ---------------------------------
CREATE TABLE public.ereporting_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_id uuid REFERENCES public.ereporting_periods(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  transaction_date date NOT NULL,
  service_date date,
  amount_ht numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  amount_ttc numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  tax_regime text,
  exemption_reason text,
  operation_category text NOT NULL DEFAULT 'services',
  country_code text NOT NULL DEFAULT 'FR',
  counterparty_kind text NOT NULL DEFAULT 'individual',
  eligibility text NOT NULL DEFAULT 'eligible'
    CHECK (eligibility IN ('eligible','not_eligible','pending_review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, invoice_id)
);

GRANT SELECT, INSERT, UPDATE ON public.ereporting_transactions TO authenticated;
GRANT ALL ON public.ereporting_transactions TO service_role;
ALTER TABLE public.ereporting_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ert_read" ON public.ereporting_transactions
  FOR SELECT TO authenticated USING (auth.uid() = driver_id OR public.is_admin(auth.uid()));
CREATE POLICY "ert_insert" ON public.ereporting_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "ert_update" ON public.ereporting_transactions
  FOR UPDATE TO authenticated USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);

CREATE TRIGGER trg_ert_updated BEFORE UPDATE ON public.ereporting_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Encaissements rattachés à une période ---------------------------------
CREATE TABLE public.ereporting_payment_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_id uuid REFERENCES public.ereporting_periods(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  paid_on date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  method text,
  vat_rate numeric,
  vat_amount numeric,
  is_partial boolean NOT NULL DEFAULT false,
  remaining_amount numeric,
  confirmed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, payment_id)
);

GRANT SELECT, INSERT, UPDATE ON public.ereporting_payment_entries TO authenticated;
GRANT ALL ON public.ereporting_payment_entries TO service_role;
ALTER TABLE public.ereporting_payment_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erpay_read" ON public.ereporting_payment_entries
  FOR SELECT TO authenticated USING (auth.uid() = driver_id OR public.is_admin(auth.uid()));
CREATE POLICY "erpay_insert" ON public.ereporting_payment_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "erpay_update" ON public.ereporting_payment_entries
  FOR UPDATE TO authenticated USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);

CREATE TRIGGER trg_erpay_updated BEFORE UPDATE ON public.ereporting_payment_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Vérifications SIREN ----------------------------------------------------
CREATE TABLE public.siren_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.billing_customers(id) ON DELETE CASCADE,
  siren text NOT NULL,
  result text NOT NULL CHECK (result IN ('format_valid','format_invalid','found_active',
                                         'found_inactive','not_found','name_mismatch','unavailable')),
  source text NOT NULL,
  registry_legal_name text,
  submitted_legal_name text,
  name_match text,
  confirmed_by_driver boolean NOT NULL DEFAULT false,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.siren_verifications TO authenticated;
GRANT ALL ON public.siren_verifications TO service_role;
ALTER TABLE public.siren_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sirenv_read" ON public.siren_verifications
  FOR SELECT TO authenticated USING (auth.uid() = driver_id OR public.is_admin(auth.uid()));
CREATE POLICY "sirenv_insert" ON public.siren_verifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = driver_id);

-- 8. Factures fournisseurs reçues ------------------------------------------
CREATE TABLE public.supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_key text,
  environment text,
  external_id text,
  supplier_name text NOT NULL,
  supplier_siren text,
  invoice_number text,
  issued_on date,
  due_on date,
  amount_ht numeric,
  amount_vat numeric,
  amount_ttc numeric,
  currency text NOT NULL DEFAULT 'EUR',
  reception_status text NOT NULL DEFAULT 'received'
    CHECK (reception_status IN ('received','read','approved','disputed','paid')),
  pdf_path text,
  structured_path text,
  structured_format text,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, provider_key, external_id)
);

GRANT SELECT, INSERT, UPDATE ON public.supplier_invoices TO authenticated;
GRANT ALL ON public.supplier_invoices TO service_role;
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supinv_read" ON public.supplier_invoices
  FOR SELECT TO authenticated USING (auth.uid() = driver_id OR public.is_admin(auth.uid()));
CREATE POLICY "supinv_insert" ON public.supplier_invoices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "supinv_update" ON public.supplier_invoices
  FOR UPDATE TO authenticated USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);

CREATE TRIGGER trg_supinv_updated BEFORE UPDATE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Transmission idempotente ----------------------------------------------
CREATE OR REPLACE FUNCTION public.start_invoice_submission(
  _invoice_id uuid,
  _provider_key text,
  _environment text,
  _routing_id text,
  _format text,
  _idempotency_key text
) RETURNS public.invoice_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver uuid;
  v_row public.invoice_submissions;
BEGIN
  SELECT driver_id INTO v_driver FROM public.invoices WHERE id = _invoice_id;
  IF v_driver IS NULL OR v_driver <> auth.uid() THEN
    RAISE EXCEPTION 'Facture introuvable ou non autorisée';
  END IF;

  SELECT * INTO v_row FROM public.invoice_submissions
   WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    RETURN v_row;
  END IF;

  -- Une transmission déjà aboutie interdit un nouvel envoi.
  IF EXISTS (
    SELECT 1 FROM public.invoice_submissions
     WHERE invoice_id = _invoice_id
       AND status IN ('submitted','acknowledged','delivered')
  ) THEN
    RAISE EXCEPTION 'Cette facture a déjà été transmise avec succès';
  END IF;

  INSERT INTO public.invoice_submissions (
    invoice_id, driver_id, provider_key, environment, recipient_routing_id,
    submitted_format, status, idempotency_key, attempt_number, created_by
  ) VALUES (
    _invoice_id, v_driver, _provider_key, COALESCE(_environment,'sandbox'), _routing_id,
    COALESCE(_format,'facturx_en16931'), 'queued', _idempotency_key,
    1 + (SELECT count(*) FROM public.invoice_submissions WHERE invoice_id = _invoice_id),
    auth.uid()
  ) RETURNING * INTO v_row;

  INSERT INTO public.invoice_submission_events (submission_id, driver_id, event_type, detail)
  VALUES (v_row.id, v_driver, 'queued', jsonb_build_object('provider', _provider_key, 'environment', _environment));

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.start_invoice_submission(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_invoice_submission(uuid, text, text, text, text, text) TO authenticated;
