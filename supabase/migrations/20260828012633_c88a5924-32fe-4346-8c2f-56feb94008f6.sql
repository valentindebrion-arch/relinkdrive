-- Détail lisible des éléments obligatoires non validés
CREATE OR REPLACE FUNCTION public.dossier_blocking_items(_state jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT string_agg(txt, ' ; ')
  FROM (
    SELECT (s->>'label') || ' : ' ||
      CASE s->>'state'
        WHEN 'todo' THEN 'élément manquant'
        WHEN 'expired' THEN 'document expiré'
        WHEN 'changes' THEN 'correction demandée / pièce refusée'
        WHEN 'review' THEN 'en attente de validation'
        ELSE s->>'state'
      END AS txt
    FROM jsonb_array_elements(_state->'sections') s
    WHERE s->>'state' <> 'approved'
  ) t;
$$;

REVOKE ALL ON FUNCTION public.dossier_blocking_items(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_section(_driver uuid, _section text, _decision text, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _state jsonb; _sec jsonb; _status text; _missing text;
BEGIN
  IF NOT public.is_admin(_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _decision NOT IN ('approve','reject','changes') THEN RAISE EXCEPTION 'décision inconnue'; END IF;
  IF _decision <> 'approve' AND COALESCE(btrim(_note), '') = '' THEN
    RAISE EXCEPTION 'un motif est obligatoire';
  END IF;

  _state := public.driver_dossier_state(_driver);
  SELECT s INTO _sec FROM jsonb_array_elements(_state->'sections') s WHERE s->>'key' = _section;
  IF _sec IS NULL THEN RAISE EXCEPTION 'section inconnue'; END IF;

  -- Une section peut être validée dès que ses éléments obligatoires sont fournis et non expirés.
  IF _decision = 'approve' AND (_sec->>'state') IN ('todo','expired') THEN
    SELECT string_agg(m, ', ') INTO _missing FROM jsonb_array_elements_text(_sec->'missing') m;
    RAISE EXCEPTION '% : % ', COALESCE(_sec->>'label', _section),
      CASE WHEN (_sec->>'state') = 'expired' THEN 'document expiré'
           ELSE COALESCE('éléments manquants (' || _missing || ')', 'élément manquant') END;
  END IF;

  _status := CASE _decision WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'changes_requested' END;

  INSERT INTO public.dossier_section_reviews (driver_id, section, status, note, admin_id)
  VALUES (_driver, _section, _status, _note, _uid)
  ON CONFLICT (driver_id, section)
  DO UPDATE SET status = _status, note = EXCLUDED.note, admin_id = _uid, updated_at = now();

  INSERT INTO public.audit_logs (actor_id, action, resource, resource_id, reason, new_value)
  VALUES (_uid, 'dossier_section_' || _status, 'driver_profiles', _driver, _note,
          jsonb_build_object('section', _section, 'status', _status));

  IF _decision IN ('reject','changes') THEN
    UPDATE public.driver_profiles
       SET verification_status = 'changes_requested',
           rejection_reason = _note,
           page_published = false,
           on_duty = false,
           accepting_requests = false
     WHERE user_id = _driver;

    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (_driver,
            CASE WHEN _decision = 'reject' THEN 'Une section de votre dossier a été refusée'
                 ELSE 'Une correction est demandée sur votre dossier' END,
            COALESCE(_sec->>'label', _section) || ' : ' || _note,
            'info', '/pro/dossier');
  END IF;

  RETURN jsonb_build_object('section', _section, 'status', _status);
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_validate_section(_driver uuid, _section text, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.admin_review_section(_driver, _section, 'approve', _note);
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_decide_driver(_driver uuid, _decision text, _reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _state jsonb; _new public.verification_status;
        _old public.verification_status; _title text; _body text; _blocking text;
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
    IF _old = 'verified' THEN
      RETURN jsonb_build_object('status', 'verified', 'already', true);
    END IF;
    _state := public.driver_dossier_state(_driver);
    IF NOT (_state->>'all_approved')::boolean THEN
      _blocking := public.dossier_blocking_items(_state);
      RAISE EXCEPTION 'éléments obligatoires non validés — %', COALESCE(_blocking, 'dossier incomplet');
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