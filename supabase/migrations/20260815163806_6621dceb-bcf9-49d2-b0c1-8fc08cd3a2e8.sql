CREATE OR REPLACE FUNCTION public.admin_review_section(_driver uuid, _section text, _decision text, _note text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _state jsonb; _sec jsonb; _status text;
BEGIN
  IF NOT public.is_admin(_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _decision NOT IN ('approve','reject','changes') THEN RAISE EXCEPTION 'décision inconnue'; END IF;
  IF _decision <> 'approve' AND COALESCE(btrim(_note), '') = '' THEN
    RAISE EXCEPTION 'un motif est obligatoire';
  END IF;

  _state := public.driver_dossier_state(_driver);
  SELECT s INTO _sec FROM jsonb_array_elements(_state->'sections') s WHERE s->>'key' = _section;
  IF _sec IS NULL THEN RAISE EXCEPTION 'section inconnue'; END IF;

  IF _decision = 'approve' AND (_sec->>'state') <> 'approved' THEN
    RAISE EXCEPTION 'chaque pièce obligatoire de la section doit être validée et valide';
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

REVOKE ALL ON FUNCTION public.admin_review_section(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_section(uuid, text, text, text) TO authenticated;