-- 1. Colonnes de suivi de la décision administrative
ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS expiry_notified_at timestamptz;

UPDATE public.driver_profiles
   SET approved_at = COALESCE(approved_at, updated_at)
 WHERE verification_status = 'verified' AND approved_at IS NULL;

-- 2. Etat du dossier : source de verite unique cote serveur
CREATE OR REPLACE FUNCTION public.driver_dossier_state(_driver uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sections jsonb := '[]'::jsonb;
  _row record;
  _p record; _d record; _c record; _v record;
  _total int := 0; _done int := 0; _approved int := 0;
  _state text; _missing text[]; _docstates text[];
  _t text; _doc record; _fields_ok boolean;
  _has_tax boolean; _has_tariff boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF auth.uid() <> _driver AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO _p FROM public.profiles WHERE id = _driver;
  SELECT * INTO _d FROM public.driver_profiles WHERE user_id = _driver;
  SELECT * INTO _c FROM public.companies WHERE driver_id = _driver LIMIT 1;
  SELECT * INTO _v FROM public.vehicles WHERE driver_id = _driver
    ORDER BY is_primary DESC, created_at LIMIT 1;
  SELECT EXISTS (SELECT 1 FROM public.driver_tax_profiles WHERE driver_id = _driver) INTO _has_tax;
  SELECT EXISTS (SELECT 1 FROM public.driver_tariffs WHERE driver_id = _driver AND basis = 'ht') INTO _has_tariff;

  FOR _row IN
    SELECT * FROM (VALUES
      ('identity', 'Identité',
        (COALESCE(btrim(_p.full_name),'') <> '' AND COALESCE(btrim(_p.phone),'') <> ''),
        ARRAY['identity']),
      ('license', 'Permis de conduire', true, ARRAY['driving_license']),
      ('vtc', 'Carte VTC',
        (COALESCE(btrim(_d.vtc_card_number),'') <> ''),
        ARRAY['vtc_card']),
      ('company', 'Entreprise',
        (COALESCE(btrim(_c.legal_name),'') <> '' AND COALESCE(btrim(_c.legal_form),'') <> ''
         AND COALESCE(btrim(_c.siret),'') <> '' AND COALESCE(btrim(_c.address),'') <> ''),
        ARRAY['company_proof']),
      ('insurance', 'Assurances', true, ARRAY['insurance']),
      ('vehicle', 'Véhicule',
        (COALESCE(btrim(_v.brand),'') <> '' AND COALESCE(btrim(_v.model),'') <> ''
         AND COALESCE(btrim(_v.plate),'') <> ''),
        ARRAY['registration','inspection']),
      ('tax', 'Fiscalité', (_has_tax AND _has_tariff), ARRAY[]::text[])
    ) AS s(key, label, fields_ok, docs)
  LOOP
    _missing := ARRAY[]::text[];
    _docstates := ARRAY[]::text[];
    _fields_ok := _row.fields_ok;
    _total := _total + 1;
    IF NOT _fields_ok THEN _missing := _missing || 'fields'; END IF;

    FOREACH _t IN ARRAY _row.docs LOOP
      _total := _total + 1;
      SELECT * INTO _doc FROM public.verification_documents
        WHERE driver_id = _driver AND doc_type = _t
        ORDER BY updated_at DESC LIMIT 1;
      IF _doc.id IS NULL OR _doc.file_path IS NULL THEN
        _missing := _missing || _t;
        _docstates := _docstates || 'missing';
      ELSE
        _done := _done + 1;
        IF _doc.expires_at IS NOT NULL AND _doc.expires_at < current_date THEN
          _docstates := _docstates || 'expired';
        ELSE
          _docstates := _docstates || _doc.status::text;
          IF _doc.status = 'approved' THEN _approved := _approved + 1; END IF;
        END IF;
      END IF;
    END LOOP;

    IF _fields_ok THEN
      _done := _done + 1;
      IF array_length(_row.docs, 1) IS NULL THEN _approved := _approved + 1; END IF;
    END IF;

    IF NOT _fields_ok OR 'missing' = ANY(_docstates) THEN
      _state := 'todo';
    ELSIF 'expired' = ANY(_docstates) THEN
      _state := 'expired';
    ELSIF 'rejected' = ANY(_docstates) THEN
      _state := 'changes';
    ELSIF array_length(_row.docs, 1) IS NULL OR NOT ('pending' = ANY(_docstates)) THEN
      _state := 'approved';
    ELSE
      _state := 'review';
    END IF;

    _sections := _sections || jsonb_build_object(
      'key', _row.key, 'label', _row.label, 'state', _state,
      'missing', to_jsonb(_missing), 'docs', to_jsonb(_row.docs)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'status', COALESCE(_d.verification_status::text, 'incomplete'),
    'sections', _sections,
    'percent', CASE WHEN _total = 0 THEN 0 ELSE floor(_done::numeric * 100 / _total)::int END,
    'complete', (_done = _total),
    'all_approved', (_approved = _total),
    'submitted_at', _d.submitted_at,
    'approved_at', _d.approved_at,
    'rejection_reason', _d.rejection_reason,
    'suspension_reason', _d.suspension_reason
  );
END; $$;

REVOKE ALL ON FUNCTION public.driver_dossier_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_dossier_state(uuid) TO authenticated;

-- 3. Envoi du dossier par le chauffeur (revalidation serveur)
CREATE OR REPLACE FUNCTION public.submit_driver_dossier()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _state jsonb; _current public.verification_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT verification_status INTO _current FROM public.driver_profiles WHERE user_id = _uid;
  IF _current IS NULL THEN RAISE EXCEPTION 'aucun dossier chauffeur'; END IF;
  IF _current = 'verified' THEN RETURN jsonb_build_object('status','verified'); END IF;
  IF _current IN ('rejected','suspended') THEN
    RAISE EXCEPTION 'ce dossier ne peut plus être envoyé';
  END IF;

  _state := public.driver_dossier_state(_uid);
  IF NOT (_state->>'complete')::boolean THEN
    RAISE EXCEPTION 'dossier incomplet';
  END IF;

  PERFORM set_config('relink.dossier_submit', '1', true);
  UPDATE public.driver_profiles
     SET verification_status = 'pending', submitted_at = now(), rejection_reason = NULL
   WHERE user_id = _uid;
  PERFORM set_config('relink.dossier_submit', '0', true);

  INSERT INTO public.audit_logs (actor_id, action, resource, resource_id, reason)
  VALUES (_uid, 'dossier_submitted', 'driver_profiles', _uid, NULL);

  RETURN jsonb_build_object('status', 'pending');
END; $$;

REVOKE ALL ON FUNCTION public.submit_driver_dossier() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_driver_dossier() TO authenticated;

-- 4. Garde chauffeur renforcee : statut, disponibilite et publication
CREATE OR REPLACE FUNCTION public.guard_driver_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    NEW.admin_note := OLD.admin_note;
    NEW.approved_at := OLD.approved_at;
    NEW.approved_by := OLD.approved_by;
    NEW.suspended_at := OLD.suspended_at;
    NEW.suspension_reason := OLD.suspension_reason;

    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      IF coalesce(current_setting('relink.dossier_submit', true), '0') = '1'
         AND OLD.verification_status IN ('incomplete','changes_requested','expired_documents')
         AND NEW.verification_status = 'pending' THEN
        NEW.rejection_reason := NULL;
      ELSE
        NEW.verification_status := OLD.verification_status;
        NEW.submitted_at := OLD.submitted_at;
      END IF;
    END IF;
    IF NEW.verification_status <> 'pending' THEN
      NEW.rejection_reason := OLD.rejection_reason;
    END IF;

    -- Aucune fonction operationnelle avant validation administrative.
    IF NEW.verification_status <> 'verified' THEN
      NEW.page_published := false;
      NEW.on_duty := false;
      NEW.accepting_requests := false;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- Un compte non valide ne peut jamais etre visible ni disponible.
UPDATE public.driver_profiles
   SET page_published = false, on_duty = false, accepting_requests = false
 WHERE verification_status <> 'verified'
   AND (page_published OR on_duty OR accepting_requests);

-- 5. Une piece remplacee repasse a verifier et replace le dossier en verification
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
      IF NEW.file_path IS DISTINCT FROM OLD.file_path
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
END; $$;

CREATE OR REPLACE FUNCTION public.after_document_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN RETURN NEW; END IF;

  INSERT INTO public.audit_logs (actor_id, action, resource, resource_id, reason)
  VALUES (auth.uid(), CASE WHEN TG_OP = 'INSERT' THEN 'document_uploaded' ELSE 'document_replaced' END,
          'verification_documents', NEW.id, NEW.doc_type);

  -- Un dossier deja valide ou en cours repasse en verification apres modification d'une piece.
  UPDATE public.driver_profiles
     SET verification_status = 'under_review'
   WHERE user_id = NEW.driver_id
     AND verification_status IN ('verified','pending','expired_documents');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_after_document_change ON public.verification_documents;
CREATE TRIGGER trg_after_document_change
AFTER INSERT OR UPDATE ON public.verification_documents
FOR EACH ROW EXECUTE FUNCTION public.after_document_change();

DROP TRIGGER IF EXISTS trg_documents_updated ON public.verification_documents;
CREATE TRIGGER trg_documents_updated
BEFORE UPDATE ON public.verification_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Decisions administrateur, piece par piece
CREATE OR REPLACE FUNCTION public.admin_review_document(_document uuid, _decision document_status, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _doc public.verification_documents%ROWTYPE;
BEGIN
  IF NOT public.is_admin(_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _doc FROM public.verification_documents WHERE id = _document;
  IF _doc.id IS NULL THEN RAISE EXCEPTION 'document introuvable'; END IF;
  IF _decision <> 'approved' AND COALESCE(btrim(_note), '') = '' THEN
    RAISE EXCEPTION 'un motif est obligatoire';
  END IF;

  UPDATE public.verification_documents
     SET status = _decision, review_note = _note, reviewed_by = _uid, reviewed_at = now()
   WHERE id = _document;

  INSERT INTO public.document_reviews (document_id, admin_id, decision, note)
  VALUES (_document, _uid, _decision, _note);

  INSERT INTO public.audit_logs (actor_id, action, resource, resource_id, reason)
  VALUES (_uid, 'document_' || _decision::text, 'verification_documents', _document, _note);
END; $$;

REVOKE ALL ON FUNCTION public.admin_review_document(uuid, document_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_document(uuid, document_status, text) TO authenticated;

-- 7. Decision globale sur le compte chauffeur
CREATE OR REPLACE FUNCTION public.admin_decide_driver(_driver uuid, _decision text, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _state jsonb; _new public.verification_status; _title text; _body text;
BEGIN
  IF NOT public.is_admin(_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _decision NOT IN ('approve','request_changes','reject','suspend','reactivate','review') THEN
    RAISE EXCEPTION 'décision inconnue';
  END IF;
  IF _decision <> 'approve' AND _decision <> 'review' AND COALESCE(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'un motif est obligatoire';
  END IF;

  IF _decision IN ('approve','reactivate') THEN
    _state := public.driver_dossier_state(_driver);
    IF NOT (_state->>'all_approved')::boolean THEN
      RAISE EXCEPTION 'tous les éléments obligatoires ne sont pas validés';
    END IF;
  END IF;

  _new := CASE _decision
    WHEN 'approve' THEN 'verified'
    WHEN 'reactivate' THEN 'verified'
    WHEN 'request_changes' THEN 'changes_requested'
    WHEN 'reject' THEN 'rejected'
    WHEN 'suspend' THEN 'suspended'
    ELSE 'under_review' END::public.verification_status;

  UPDATE public.driver_profiles
     SET verification_status = _new,
         rejection_reason = CASE WHEN _decision IN ('request_changes','reject') THEN _reason ELSE NULL END,
         admin_note = _reason,
         approved_at = CASE WHEN _new = 'verified' THEN now() ELSE approved_at END,
         approved_by = CASE WHEN _new = 'verified' THEN _uid ELSE approved_by END,
         suspended_at = CASE WHEN _decision = 'suspend' THEN now()
                             WHEN _decision = 'reactivate' THEN NULL ELSE suspended_at END,
         suspension_reason = CASE WHEN _decision = 'suspend' THEN _reason
                                  WHEN _decision = 'reactivate' THEN NULL ELSE suspension_reason END,
         page_published = CASE WHEN _new = 'verified' THEN true ELSE false END,
         on_duty = CASE WHEN _new = 'verified' THEN on_duty ELSE false END,
         accepting_requests = CASE WHEN _new = 'verified' THEN accepting_requests ELSE false END
   WHERE user_id = _driver;

  INSERT INTO public.audit_logs (actor_id, action, resource, resource_id, reason, new_value)
  VALUES (_uid, 'driver_' || _decision, 'driver_profiles', _driver, _reason,
          jsonb_build_object('status', _new::text));

  _title := CASE _decision
    WHEN 'approve' THEN 'Votre compte professionnel est validé'
    WHEN 'reactivate' THEN 'Votre compte professionnel est réactivé'
    WHEN 'request_changes' THEN 'Des corrections sont nécessaires'
    WHEN 'reject' THEN 'Votre dossier a été refusé'
    WHEN 'suspend' THEN 'Votre compte est suspendu'
    ELSE 'Votre dossier est en cours de vérification' END;
  _body := CASE _decision
    WHEN 'approve' THEN 'Vous pouvez maintenant utiliser toutes les fonctionnalités ReLink.'
    WHEN 'reactivate' THEN 'Vous pouvez de nouveau recevoir des demandes.'
    ELSE COALESCE(_reason, 'Consultez votre dossier pour le détail.') END;

  INSERT INTO public.notifications (user_id, title, body, kind, link)
  VALUES (_driver, _title, _body, 'info', '/pro/dossier');

  RETURN jsonb_build_object('status', _new::text);
END; $$;

REVOKE ALL ON FUNCTION public.admin_decide_driver(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_decide_driver(uuid, text, text) TO authenticated;

-- 8. Aucune demande vers un chauffeur non valide
CREATE OR REPLACE FUNCTION public.guard_ride_request_driver_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NOT public.is_verified_driver(NEW.driver_id) THEN
    RAISE EXCEPTION 'Ce chauffeur n''est pas disponible actuellement.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_ride_request_driver_verified ON public.ride_requests;
CREATE TRIGGER trg_guard_ride_request_driver_verified
BEFORE INSERT ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_ride_request_driver_verified();

-- 9. Expiration des documents obligatoires + alertes 60/30/7 jours
CREATE OR REPLACE FUNCTION public.process_document_expiry()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _n int := 0; _r record;
BEGIN
  UPDATE public.verification_documents
     SET status = 'expired'
   WHERE expires_at IS NOT NULL AND expires_at < current_date AND status <> 'expired';

  FOR _r IN
    SELECT DISTINCT vd.driver_id, min(vd.expires_at) AS soonest
    FROM public.verification_documents vd
    WHERE vd.expires_at IS NOT NULL
      AND vd.doc_type IN ('identity','driving_license','vtc_card','company_proof','registration','insurance','inspection')
      AND vd.expires_at BETWEEN current_date AND current_date + 60
    GROUP BY vd.driver_id
  LOOP
    IF (_r.soonest - current_date) IN (60, 30, 7) THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (_r.driver_id, 'Document bientôt expiré',
              'Un justificatif obligatoire expire le ' || to_char(_r.soonest, 'DD/MM/YYYY') ||
              '. Remplacez-le pour conserver votre compte actif.', 'info', '/pro/dossier');
    END IF;
  END LOOP;

  FOR _r IN
    SELECT d.user_id FROM public.driver_profiles d
    WHERE d.verification_status = 'verified'
      AND EXISTS (
        SELECT 1 FROM public.verification_documents vd
        WHERE vd.driver_id = d.user_id AND vd.status = 'expired'
          AND vd.doc_type IN ('identity','driving_license','vtc_card','company_proof','registration','insurance','inspection')
      )
  LOOP
    UPDATE public.driver_profiles
       SET verification_status = 'expired_documents',
           page_published = false, on_duty = false, accepting_requests = false
     WHERE user_id = _r.user_id;
    INSERT INTO public.audit_logs (actor_id, action, resource, resource_id, reason)
    VALUES (NULL, 'driver_expired_documents', 'driver_profiles', _r.user_id, 'Justificatif obligatoire expiré');
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (_r.user_id, 'Compte suspendu : document expiré',
            'Un justificatif obligatoire a expiré. Remplacez-le pour réactiver votre compte.', 'info', '/pro/dossier');
    _n := _n + 1;
  END LOOP;

  RETURN _n;
END; $$;

REVOKE ALL ON FUNCTION public.process_document_expiry() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('relink-document-expiry')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'relink-document-expiry');

SELECT cron.schedule('relink-document-expiry', '15 3 * * *', $cron$SELECT public.process_document_expiry();$cron$);