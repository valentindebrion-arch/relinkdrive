
-- 1) driver_profiles : verrouiller aussi billing_status / plan_expires_at
CREATE OR REPLACE FUNCTION public.guard_driver_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    NEW.plan := OLD.plan;
    NEW.plan_started_at := OLD.plan_started_at;
    NEW.plan_renews_at := OLD.plan_renews_at;
    NEW.plan_expires_at := OLD.plan_expires_at;
    NEW.billing_status := OLD.billing_status;
  END IF;

  IF NEW.booking_theme IS DISTINCT FROM OLD.booking_theme
     AND COALESCE(NEW.plan, OLD.plan, 'free') <> 'pro'
     AND NOT public.is_admin(auth.uid()) THEN
    NEW.booking_theme := OLD.booking_theme;
  END IF;

  RETURN NEW;
END; $function$;

-- 2) companies : champs de conformité / vérification réservés à l'admin
CREATE OR REPLACE FUNCTION public.guard_company_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_admin(auth.uid()) THEN
      NEW.legal_verified_at := NULL;
      NEW.entity_category_source := 'declared';
      NEW.pa_provider := NULL;
      NEW.pa_account_id := NULL;
      NEW.pa_status := NULL;
      NEW.pa_last_sync_at := NULL;
      NEW.pa_environment := NULL;
      NEW.receive_enabled := false;
      NEW.issue_enabled := false;
      NEW.ereporting_enabled := false;
      NEW.obligation_start_on := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
    RAISE EXCEPTION 'driver_id cannot be changed';
  END IF;

  IF NOT public.is_admin(auth.uid()) THEN
    NEW.legal_verified_at := OLD.legal_verified_at;
    NEW.entity_category_source := OLD.entity_category_source;
    NEW.pa_provider := OLD.pa_provider;
    NEW.pa_account_id := OLD.pa_account_id;
    NEW.pa_status := OLD.pa_status;
    NEW.pa_last_sync_at := OLD.pa_last_sync_at;
    NEW.pa_environment := OLD.pa_environment;
    NEW.receive_enabled := OLD.receive_enabled;
    NEW.issue_enabled := OLD.issue_enabled;
    NEW.ereporting_enabled := OLD.ereporting_enabled;
    NEW.obligation_start_on := OLD.obligation_start_on;
  END IF;

  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_guard_company_admin_fields ON public.companies;
CREATE TRIGGER trg_guard_company_admin_fields
BEFORE INSERT OR UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.guard_company_admin_fields();

-- 3) verification_documents : tout changement de pièce repasse en attente
CREATE OR REPLACE FUNCTION public.guard_verification_document_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'pending';
      NEW.review_note := NULL;
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
    ELSE
      IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
        RAISE EXCEPTION 'driver_id cannot be changed';
      END IF;
      IF NEW.file_path IS DISTINCT FROM OLD.file_path
         OR NEW.doc_type IS DISTINCT FROM OLD.doc_type
         OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
        NEW.status := 'pending';
        NEW.review_note := NULL;
        NEW.reviewed_by := NULL;
        NEW.reviewed_at := NULL;
      ELSE
        NEW.status := OLD.status;
        NEW.review_note := OLD.review_note;
        NEW.reviewed_by := OLD.reviewed_by;
        NEW.reviewed_at := OLD.reviewed_at;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

-- 4) invoices : champs légaux/système écrits uniquement par les fonctions internes
DO $$
DECLARE
  _locked text[] := ARRAY[
    'driver_id','number','issued_at','issued_number_year','credit_note_of','replaced_by',
    'routing_channel','transmission_status','transmission_error','transmitted_at','external_id',
    'structured_format','structured_path','pdf_path','document_hash','facturx_profile',
    'facturx_spec_version','structured_hash','pdf_hash','documents_generated_at','legacy_pre_reform'
  ];
  _cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO _cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'invoices'
     AND NOT (column_name = ANY(_locked));

  EXECUTE 'REVOKE UPDATE ON public.invoices FROM authenticated';
  EXECUTE format('GRANT UPDATE (%s) ON public.invoices TO authenticated', _cols);
END $$;
