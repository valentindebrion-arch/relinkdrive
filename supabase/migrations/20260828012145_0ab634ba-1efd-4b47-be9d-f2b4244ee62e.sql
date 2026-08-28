CREATE OR REPLACE FUNCTION public.submit_driver_dossier()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _state jsonb; _current public.verification_status; _missing text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT verification_status INTO _current FROM public.driver_profiles WHERE user_id = _uid;
  IF _current IS NULL THEN RAISE EXCEPTION 'aucun dossier chauffeur'; END IF;
  IF _current = 'verified' THEN RETURN jsonb_build_object('status','verified'); END IF;
  IF _current = 'suspended' THEN
    RAISE EXCEPTION 'ce dossier ne peut plus être envoyé';
  END IF;

  _state := public.driver_dossier_state(_uid);
  IF NOT (_state->>'complete')::boolean THEN
    SELECT string_agg(m, ', ') INTO _missing
      FROM jsonb_array_elements(_state->'sections') s,
           jsonb_array_elements_text(s->'missing') m;
    RAISE EXCEPTION 'dossier incomplet: %', COALESCE(_missing, 'éléments obligatoires manquants');
  END IF;

  PERFORM set_config('relink.dossier_submit', '1', true);
  UPDATE public.driver_profiles
     SET verification_status = 'pending', submitted_at = now(), rejection_reason = NULL
   WHERE user_id = _uid;
  PERFORM set_config('relink.dossier_submit', '0', true);

  INSERT INTO public.audit_logs (actor_id, action, resource, resource_id, reason)
  VALUES (_uid, 'dossier_submitted', 'driver_profiles', _uid, NULL);

  RETURN jsonb_build_object('status', 'pending');
END; $function$;