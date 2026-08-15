CREATE OR REPLACE FUNCTION public.driver_dossier_state(_driver uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- Les informations saisies comptent comme validées dès qu'elles sont complètes.
    IF _fields_ok THEN
      _done := _done + 1;
      _approved := _approved + 1;
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
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_decide_driver(_driver uuid, _decision text, _reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _state jsonb; _new public.verification_status;
        _old public.verification_status; _title text; _body text;
BEGIN
  IF NOT public.is_admin(_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _decision NOT IN ('approve','request_changes','reject','suspend','reactivate','review') THEN
    RAISE EXCEPTION 'décision inconnue';
  END IF;
  IF _decision <> 'approve' AND _decision <> 'review' AND COALESCE(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'un motif est obligatoire';
  END IF;

  SELECT verification_status INTO _old FROM public.driver_profiles WHERE user_id = _driver;
  IF _old IS NULL THEN RAISE EXCEPTION 'chauffeur introuvable'; END IF;
  IF NOT public.has_role(_driver, 'driver') THEN RAISE EXCEPTION 'ce compte n''est pas un compte chauffeur'; END IF;

  IF _decision IN ('approve','reactivate') THEN
    -- Idempotence : un compte déjà validé ne rejoue pas la validation.
    IF _old = 'verified' THEN
      RETURN jsonb_build_object('status', 'verified', 'already', true);
    END IF;
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

  INSERT INTO public.audit_logs (actor_id, action, resource, resource_id, reason, old_value, new_value)
  VALUES (_uid, 'driver_' || _decision, 'driver_profiles', _driver, _reason,
          jsonb_build_object('status', _old::text),
          jsonb_build_object(
            'status', _new::text,
            'documents', COALESCE((
              SELECT jsonb_agg(jsonb_build_object('type', v.doc_type, 'status', v.status::text, 'id', v.id))
              FROM public.verification_documents v WHERE v.driver_id = _driver), '[]'::jsonb)));

  _title := CASE _decision
    WHEN 'approve' THEN 'Votre compte a été validé'
    WHEN 'reactivate' THEN 'Votre compte professionnel est réactivé'
    WHEN 'request_changes' THEN 'Des corrections sont nécessaires'
    WHEN 'reject' THEN 'Votre dossier a été refusé'
    WHEN 'suspend' THEN 'Votre compte est suspendu'
    ELSE 'Votre dossier est en cours de vérification' END;
  _body := CASE _decision
    WHEN 'approve' THEN 'Votre dossier a été approuvé. Vous avez désormais accès à l''ensemble des fonctionnalités professionnelles de ReLink.'
    WHEN 'reactivate' THEN 'Vous pouvez de nouveau recevoir des demandes.'
    ELSE COALESCE(_reason, 'Consultez votre dossier pour le détail.') END;

  INSERT INTO public.notifications (user_id, title, body, kind, link)
  VALUES (_driver, _title, _body, 'info', CASE WHEN _new = 'verified' THEN '/pro' ELSE '/pro/dossier' END);

  RETURN jsonb_build_object('status', _new::text);
END; $function$;