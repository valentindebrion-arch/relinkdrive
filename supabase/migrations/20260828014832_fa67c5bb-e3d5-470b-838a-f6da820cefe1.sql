CREATE OR REPLACE FUNCTION public.is_service_role_call()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.role(), '') = 'service_role'
      OR COALESCE(current_setting('role', true), '') = 'service_role';
$$;

REVOKE ALL ON FUNCTION public.is_service_role_call() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.driver_dossier_state(_driver uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _sections jsonb := '[]'::jsonb;
  _row record;
  _d record;
  _total int := 0; _done int := 0; _approved int := 0;
  _state text; _missing text[]; _docstates text[];
  _t text; _doc record; _fields_ok boolean;
  _pro_review text;
BEGIN
  IF NOT public.is_service_role_call() THEN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
    IF auth.uid() <> _driver AND NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  SELECT * INTO _d FROM public.driver_profiles WHERE user_id = _driver;
  SELECT status INTO _pro_review FROM public.dossier_section_reviews
    WHERE driver_id = _driver AND section = 'pro';

  FOR _row IN
    SELECT * FROM (VALUES
      ('license', 'Permis de conduire', true, ARRAY['driving_license','driving_license_back']),
      ('identity', 'Pièce d''identité', true, ARRAY['identity','identity_back']),
      ('pro', 'Informations professionnelles',
        (CASE WHEN COALESCE(_d.driver_kind,'vtc') = 'taxi'
              THEN COALESCE(btrim(_d.taxi_license_number),'') <> ''
              ELSE COALESCE(btrim(_d.vtc_card_number),'') <> '' END),
        ARRAY[]::text[]),
      ('insurance', 'Assurance professionnelle', true, ARRAY['insurance'])
    ) AS s(key, label, fields_ok, docs)
  LOOP
    _missing := ARRAY[]::text[];
    _docstates := ARRAY[]::text[];
    _fields_ok := _row.fields_ok;
    IF array_length(_row.docs, 1) IS NULL THEN
      _total := _total + 1;
      IF NOT _fields_ok THEN _missing := _missing || 'fields'; ELSE _done := _done + 1; END IF;
    END IF;

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

    IF array_length(_row.docs, 1) IS NULL THEN
      IF NOT _fields_ok THEN
        _state := 'todo';
      ELSIF _pro_review = 'approved' THEN
        _state := 'approved';
        _approved := _approved + 1;
      ELSIF _pro_review IN ('rejected','changes_requested') THEN
        _state := 'changes';
      ELSE
        _state := 'review';
      END IF;
    ELSE
      IF 'missing' = ANY(_docstates) THEN
        _state := 'todo';
      ELSIF 'expired' = ANY(_docstates) THEN
        _state := 'expired';
      ELSIF 'rejected' = ANY(_docstates) THEN
        _state := 'changes';
      ELSIF NOT ('pending' = ANY(_docstates)) THEN
        _state := 'approved';
      ELSE
        _state := 'review';
      END IF;
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
    'driver_kind', COALESCE(_d.driver_kind, 'vtc'),
    'submitted_at', _d.submitted_at,
    'approved_at', _d.approved_at,
    'rejection_reason', _d.rejection_reason,
    'suspension_reason', _d.suspension_reason
  );
END;
$function$;