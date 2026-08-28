-- 1) Documents de vérification : blocage explicite des champs d'administration
CREATE OR REPLACE FUNCTION public.guard_verification_document_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status IS DISTINCT FROM 'pending'::document_status
         OR NEW.review_note IS NOT NULL
         OR NEW.reviewed_by IS NOT NULL
         OR NEW.reviewed_at IS NOT NULL THEN
        RAISE EXCEPTION 'review_fields_admin_only';
      END IF;
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
        -- Nouveau justificatif : retour obligatoire en attente de validation.
        NEW.status := 'pending';
        NEW.review_note := NULL;
        NEW.reviewed_by := NULL;
        NEW.reviewed_at := NULL;
      ELSE
        IF NEW.status IS DISTINCT FROM OLD.status
           OR NEW.review_note IS DISTINCT FROM OLD.review_note
           OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
           OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
          RAISE EXCEPTION 'review_fields_admin_only';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_guard_verification_document_admin_fields ON public.verification_documents;
CREATE TRIGGER trg_guard_verification_document_admin_fields
BEFORE INSERT OR UPDATE ON public.verification_documents
FOR EACH ROW EXECUTE FUNCTION public.guard_verification_document_admin_fields();

-- 2) Historique des formules : lecture seule pour les comptes connectés, écriture interne uniquement
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.driver_plan_changes FROM anon, authenticated;
REVOKE ALL ON public.driver_plan_changes FROM anon;
GRANT SELECT ON public.driver_plan_changes TO authenticated;
GRANT ALL ON public.driver_plan_changes TO service_role;

DROP POLICY IF EXISTS plan_changes_no_client_write ON public.driver_plan_changes;
CREATE POLICY plan_changes_no_client_write
ON public.driver_plan_changes
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (false);