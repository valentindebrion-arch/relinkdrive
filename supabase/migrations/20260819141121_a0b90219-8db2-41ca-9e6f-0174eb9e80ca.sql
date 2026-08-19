-- ============================================================
-- LOT 2 — Facturation électronique : paramètres, formats, transmission
-- ============================================================

-- 1. Paramètres de conformité de l'entreprise émettrice
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS entity_category_source text NOT NULL DEFAULT 'declared',
  ADD COLUMN IF NOT EXISTS obligation_start_on date,
  ADD COLUMN IF NOT EXISTS anticipation_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pa_environment text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS receive_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS issue_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ereporting_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_entity_category_source_chk;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_entity_category_source_chk
  CHECK (entity_category_source IN ('declared','document','registry'));

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_pa_environment_chk;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_pa_environment_chk
  CHECK (pa_environment IN ('sandbox','production'));

-- 2. Données de routage du client facturé
ALTER TABLE public.billing_customers
  ADD COLUMN IF NOT EXISTS accounting_email text,
  ADD COLUMN IF NOT EXISTS recipient_platform text,
  ADD COLUMN IF NOT EXISTS routing_id text,
  ADD COLUMN IF NOT EXISTS routing_scheme text,
  ADD COLUMN IF NOT EXISTS siren_check_status text NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS siren_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_name_match text NOT NULL DEFAULT 'unchecked';

ALTER TABLE public.billing_customers
  DROP CONSTRAINT IF EXISTS billing_customers_siren_check_chk;
ALTER TABLE public.billing_customers
  ADD CONSTRAINT billing_customers_siren_check_chk
  CHECK (siren_check_status IN ('unchecked','format_valid','format_invalid','registry_active','registry_inactive','registry_unknown'));

ALTER TABLE public.billing_customers
  DROP CONSTRAINT IF EXISTS billing_customers_legal_name_match_chk;
ALTER TABLE public.billing_customers
  ADD CONSTRAINT billing_customers_legal_name_match_chk
  CHECK (legal_name_match IN ('unchecked','match','mismatch'));

UPDATE public.billing_customers
   SET siren_check_status = 'format_valid'
 WHERE siren IS NOT NULL AND siren_check_status = 'unchecked' AND public.is_valid_siren(siren);

-- 3. Factures : métadonnées des formats structurés
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS facturx_profile text,
  ADD COLUMN IF NOT EXISTS facturx_spec_version text,
  ADD COLUMN IF NOT EXISTS structured_hash text,
  ADD COLUMN IF NOT EXISTS pdf_hash text,
  ADD COLUMN IF NOT EXISTS documents_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS legacy_pre_reform boolean NOT NULL DEFAULT false;

-- Factures émises avant le socle conforme : hors périmètre des formats structurés
UPDATE public.invoices
   SET legacy_pre_reform = true
 WHERE number IS NOT NULL AND issuer_snapshot IS NULL;

-- 4. Documents conservés (PDF lisible, Factur-X, XML)
CREATE TABLE IF NOT EXISTS public.invoice_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  path text NOT NULL,
  sha256 text NOT NULL,
  byte_size int,
  content_type text,
  spec_version text,
  profile text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_documents_kind_chk CHECK (kind IN ('pdf','facturx','xml')),
  CONSTRAINT invoice_documents_unique UNIQUE (invoice_id, kind)
);

CREATE INDEX IF NOT EXISTS invoice_documents_driver_idx ON public.invoice_documents(driver_id);

GRANT SELECT ON public.invoice_documents TO authenticated;
GRANT ALL ON public.invoice_documents TO service_role;
ALTER TABLE public.invoice_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Driver reads own invoice documents" ON public.invoice_documents;
CREATE POLICY "Driver reads own invoice documents"
  ON public.invoice_documents FOR SELECT TO authenticated
  USING (auth.uid() = driver_id OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_invoice_document_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION 'Un document de facture conservé ne peut être ni modifié ni supprimé';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_invoice_document_immutable() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS invoice_documents_immutable ON public.invoice_documents;
CREATE TRIGGER invoice_documents_immutable
  BEFORE UPDATE OR DELETE ON public.invoice_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_document_immutable();

-- 5. Journal des transmissions vers une plateforme agréée
CREATE TABLE IF NOT EXISTS public.invoice_transmissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'outbound',
  channel text NOT NULL,
  pa_provider text,
  status text NOT NULL DEFAULT 'pending',
  external_id text,
  ack_code text,
  ack_message text,
  detail jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_transmissions_direction_chk CHECK (direction IN ('outbound','inbound')),
  CONSTRAINT invoice_transmissions_channel_chk CHECK (channel IN ('portal','ereporting','manual_file')),
  CONSTRAINT invoice_transmissions_status_chk
    CHECK (status IN ('pending','sent','acknowledged','accepted','rejected','failed','not_configured'))
);

CREATE INDEX IF NOT EXISTS invoice_transmissions_invoice_idx ON public.invoice_transmissions(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_transmissions_driver_idx ON public.invoice_transmissions(driver_id);

GRANT SELECT ON public.invoice_transmissions TO authenticated;
GRANT ALL ON public.invoice_transmissions TO service_role;
ALTER TABLE public.invoice_transmissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Driver reads own transmissions" ON public.invoice_transmissions;
CREATE POLICY "Driver reads own transmissions"
  ON public.invoice_transmissions FOR SELECT TO authenticated
  USING (auth.uid() = driver_id OR public.is_admin(auth.uid()));

-- 6. E-reporting (transactions B2C et données d'encaissement)
CREATE TABLE IF NOT EXISTS public.ereporting_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE RESTRICT,
  kind text NOT NULL,
  period_start date,
  period_end date,
  currency text NOT NULL DEFAULT 'EUR',
  total_ht numeric NOT NULL DEFAULT 0,
  total_vat numeric NOT NULL DEFAULT 0,
  total_ttc numeric NOT NULL DEFAULT 0,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  pa_provider text,
  external_id text,
  ack_code text,
  ack_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ereporting_kind_chk CHECK (kind IN ('transaction','payment')),
  CONSTRAINT ereporting_status_chk
    CHECK (status IN ('pending','sent','acknowledged','accepted','rejected','failed','not_configured'))
);

CREATE INDEX IF NOT EXISTS ereporting_driver_idx ON public.ereporting_submissions(driver_id);

GRANT SELECT ON public.ereporting_submissions TO authenticated;
GRANT ALL ON public.ereporting_submissions TO service_role;
ALTER TABLE public.ereporting_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Driver reads own ereporting" ON public.ereporting_submissions;
CREATE POLICY "Driver reads own ereporting"
  ON public.ereporting_submissions FOR SELECT TO authenticated
  USING (auth.uid() = driver_id OR public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS ereporting_updated_at ON public.ereporting_submissions;
CREATE TRIGGER ereporting_updated_at
  BEFORE UPDATE ON public.ereporting_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Enregistrement des documents générés (une seule fois par facture)
CREATE OR REPLACE FUNCTION public.record_invoice_documents(_invoice_id uuid, _docs jsonb)
RETURNS SETOF public.invoice_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.invoices;
  _d jsonb;
BEGIN
  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id FOR UPDATE;
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'Facture introuvable'; END IF;
  IF _inv.driver_id <> auth.uid() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF _inv.number IS NULL THEN RAISE EXCEPTION 'La facture doit être émise avant conservation des formats'; END IF;

  FOR _d IN SELECT * FROM jsonb_array_elements(_docs) LOOP
    INSERT INTO public.invoice_documents (invoice_id, driver_id, kind, path, sha256, byte_size, content_type, spec_version, profile)
    VALUES (
      _invoice_id, _inv.driver_id,
      _d->>'kind', _d->>'path', _d->>'sha256',
      NULLIF(_d->>'byte_size','')::int, _d->>'content_type', _d->>'spec_version', _d->>'profile'
    )
    ON CONFLICT (invoice_id, kind) DO NOTHING;
  END LOOP;

  UPDATE public.invoices SET
    pdf_path = COALESCE(pdf_path, (SELECT path FROM public.invoice_documents WHERE invoice_id = _invoice_id AND kind = 'pdf')),
    pdf_hash = COALESCE(pdf_hash, (SELECT sha256 FROM public.invoice_documents WHERE invoice_id = _invoice_id AND kind = 'pdf')),
    structured_path = COALESCE(structured_path, (SELECT path FROM public.invoice_documents WHERE invoice_id = _invoice_id AND kind = 'xml')),
    structured_hash = COALESCE(structured_hash, (SELECT sha256 FROM public.invoice_documents WHERE invoice_id = _invoice_id AND kind = 'xml')),
    structured_format = COALESCE(structured_format, 'facturx-cii'),
    document_hash = COALESCE(document_hash, (SELECT sha256 FROM public.invoice_documents WHERE invoice_id = _invoice_id AND kind = 'facturx')),
    facturx_profile = COALESCE(facturx_profile, (SELECT profile FROM public.invoice_documents WHERE invoice_id = _invoice_id AND kind = 'facturx')),
    facturx_spec_version = COALESCE(facturx_spec_version, (SELECT spec_version FROM public.invoice_documents WHERE invoice_id = _invoice_id AND kind = 'facturx')),
    documents_generated_at = COALESCE(documents_generated_at, now())
  WHERE id = _invoice_id;

  INSERT INTO public.invoice_events (invoice_id, driver_id, actor_id, event, detail)
  VALUES (_invoice_id, _inv.driver_id, auth.uid(), 'documents_archived', _docs);

  RETURN QUERY SELECT * FROM public.invoice_documents WHERE invoice_id = _invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_invoice_documents(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_invoice_documents(uuid, jsonb) TO authenticated;

-- 8. Journalisation d'une tentative de transmission
CREATE OR REPLACE FUNCTION public.record_invoice_transmission(
  _invoice_id uuid,
  _channel text,
  _status text,
  _pa_provider text DEFAULT NULL,
  _external_id text DEFAULT NULL,
  _ack_code text DEFAULT NULL,
  _ack_message text DEFAULT NULL,
  _detail jsonb DEFAULT NULL
)
RETURNS public.invoice_transmissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.invoices;
  _row public.invoice_transmissions;
BEGIN
  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id;
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'Facture introuvable'; END IF;
  IF _inv.driver_id <> auth.uid() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF _inv.number IS NULL THEN RAISE EXCEPTION 'Seule une facture émise peut être transmise'; END IF;

  INSERT INTO public.invoice_transmissions (invoice_id, driver_id, channel, pa_provider, status, external_id, ack_code, ack_message, detail)
  VALUES (_invoice_id, _inv.driver_id, _channel, _pa_provider, _status, _external_id, _ack_code, _ack_message, _detail)
  RETURNING * INTO _row;

  UPDATE public.invoices SET
    transmission_status = CASE _status
      WHEN 'sent' THEN 'sent'
      WHEN 'acknowledged' THEN 'sent'
      WHEN 'accepted' THEN 'accepted'
      WHEN 'rejected' THEN 'rejected'
      WHEN 'failed' THEN 'failed'
      ELSE 'pending' END,
    transmitted_at = CASE WHEN _status IN ('sent','acknowledged','accepted') THEN now() ELSE transmitted_at END,
    transmission_error = CASE WHEN _status IN ('rejected','failed','not_configured') THEN _ack_message ELSE NULL END,
    external_id = COALESCE(_external_id, external_id)
  WHERE id = _invoice_id;

  INSERT INTO public.invoice_events (invoice_id, driver_id, actor_id, event, detail)
  VALUES (_invoice_id, _inv.driver_id, auth.uid(), 'transmission_' || _status,
          jsonb_build_object('channel', _channel, 'provider', _pa_provider, 'message', _ack_message));

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_invoice_transmission(uuid, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_invoice_transmission(uuid, text, text, text, text, text, text, jsonb) TO authenticated;

-- 9. Mise en file d'une déclaration d'e-reporting
CREATE OR REPLACE FUNCTION public.queue_ereporting(
  _invoice_id uuid,
  _kind text,
  _payload jsonb DEFAULT NULL
)
RETURNS public.ereporting_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.invoices;
  _row public.ereporting_submissions;
  _vat numeric;
BEGIN
  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id;
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'Facture introuvable'; END IF;
  IF _inv.driver_id <> auth.uid() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF _inv.number IS NULL THEN RAISE EXCEPTION 'Seule une facture émise peut être déclarée'; END IF;
  IF _kind NOT IN ('transaction','payment') THEN RAISE EXCEPTION 'Type de déclaration inconnu'; END IF;

  _vat := GREATEST(COALESCE(_inv.amount_ttc,0) - COALESCE(_inv.amount_ht,0), 0);

  INSERT INTO public.ereporting_submissions (
    driver_id, invoice_id, kind, period_start, period_end, currency,
    total_ht, total_vat, total_ttc, payload, status
  ) VALUES (
    _inv.driver_id, _invoice_id, _kind,
    date_trunc('month', COALESCE(_inv.issued_on, current_date))::date,
    (date_trunc('month', COALESCE(_inv.issued_on, current_date)) + interval '1 month - 1 day')::date,
    COALESCE(_inv.currency,'EUR'),
    CASE WHEN _kind = 'payment' THEN COALESCE(_inv.amount_paid,0) ELSE COALESCE(_inv.amount_ht,0) END,
    CASE WHEN _kind = 'payment' THEN 0 ELSE _vat END,
    CASE WHEN _kind = 'payment' THEN COALESCE(_inv.amount_paid,0) ELSE COALESCE(_inv.amount_ttc,0) END,
    _payload, 'pending'
  ) RETURNING * INTO _row;

  INSERT INTO public.invoice_events (invoice_id, driver_id, actor_id, event, detail)
  VALUES (_invoice_id, _inv.driver_id, auth.uid(), 'ereporting_' || _kind, jsonb_build_object('submission', _row.id));

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_ereporting(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.queue_ereporting(uuid, text, jsonb) TO authenticated;