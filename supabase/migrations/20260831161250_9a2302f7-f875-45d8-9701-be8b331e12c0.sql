-- 1. Fin du blocage lié à la vérification administrative
ALTER TABLE public.driver_profiles ALTER COLUMN verification_status SET DEFAULT 'verified'::public.verification_status;

UPDATE public.driver_profiles
   SET verification_status = 'verified'::public.verification_status
 WHERE verification_status <> 'verified';

CREATE OR REPLACE FUNCTION public.enforce_page_published_requires_verified()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- La vérification administrative n'est plus une condition d'utilisation.
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.guard_driver_profile_admin_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    NEW.admin_note := OLD.admin_note;
    NEW.approved_at := OLD.approved_at;
    NEW.approved_by := OLD.approved_by;
    NEW.suspended_at := OLD.suspended_at;
    NEW.suspension_reason := OLD.suspension_reason;

    NEW.women_for_women_eligible := OLD.women_for_women_eligible;
    NEW.women_for_women_verified_at := OLD.women_for_women_verified_at;
    NEW.women_for_women_verified_by := OLD.women_for_women_verified_by;

    -- Le statut de vérification reste géré par l'administration uniquement,
    -- mais il ne conditionne plus la publication de la vitrine.
    NEW.verification_status := OLD.verification_status;
    NEW.submitted_at := OLD.submitted_at;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;

  IF NEW.booking_theme = 'women_for_women' AND coalesce(NEW.women_for_women_eligible, false) = false THEN
    NEW.booking_theme := 'relink_classic';
  END IF;

  IF NEW.booking_theme IS DISTINCT FROM OLD.booking_theme THEN
    NEW.theme_updated_at := now();
  END IF;

  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.after_document_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_admin(auth.uid()) THEN RETURN NEW; END IF;

  INSERT INTO public.audit_logs (actor_id, action, resource, resource_id, reason)
  VALUES (auth.uid(), CASE WHEN TG_OP = 'INSERT' THEN 'document_uploaded' ELSE 'document_replaced' END,
          'verification_documents', NEW.id, NEW.doc_type);
  -- Plus de retour en vérification : le compte reste actif.
  RETURN NEW;
END; $function$;

-- 2. Arrêt des notifications internes et des push
DROP TRIGGER IF EXISTS trg_dispatch_push_notification ON public.notifications;
DROP TRIGGER IF EXISTS trg_notify_new_connection ON public.driver_client_connections;

CREATE OR REPLACE FUNCTION public.notify_counterparty(_recipient uuid, _kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- Système de notifications désactivé.
  RETURN;
END; $function$;