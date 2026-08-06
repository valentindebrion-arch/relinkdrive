CREATE OR REPLACE FUNCTION public.guard_driver_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    NEW.verification_status := OLD.verification_status;
    NEW.admin_note := OLD.admin_note;
    NEW.rejection_reason := OLD.rejection_reason;
    IF OLD.verification_status <> 'verified' THEN
      NEW.page_published := OLD.page_published;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_driver_profile_admin_fields ON public.driver_profiles;
CREATE TRIGGER trg_guard_driver_profile_admin_fields
BEFORE UPDATE ON public.driver_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_driver_profile_admin_fields();

CREATE OR REPLACE FUNCTION public.guard_verification_document_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    IF TG_OP = 'INSERT' THEN
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
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_verification_document_admin_fields ON public.verification_documents;
CREATE TRIGGER trg_guard_verification_document_admin_fields
BEFORE INSERT OR UPDATE ON public.verification_documents
FOR EACH ROW EXECUTE FUNCTION public.guard_verification_document_admin_fields();

REVOKE ALL ON FUNCTION public.guard_driver_profile_admin_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_verification_document_admin_fields() FROM PUBLIC, anon, authenticated;