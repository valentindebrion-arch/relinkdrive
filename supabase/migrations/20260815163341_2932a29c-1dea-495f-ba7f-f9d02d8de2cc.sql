CREATE OR REPLACE FUNCTION public.create_client_ride_request(_driver uuid, _pickup text, _dropoff text, _scheduled_at timestamp with time zone, _passengers integer, _luggage integer, _comment text, _special_needs text, _round_trip boolean, _trip_type text, _proposed_price numeric, _immediate boolean, _idempotency_key text, _cgu_version text DEFAULT NULL::text, _cgv_version text DEFAULT NULL::text, _cancellation_version text DEFAULT NULL::text, _distance_km numeric DEFAULT NULL::numeric)
 RETURNS TABLE(request_id uuid, reused boolean, blocked boolean, blocking_request_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _existing uuid; _blocking uuid; _new uuid;
  _q record; _legal_name text; _price numeric;
  _on_duty boolean; _when timestamptz := COALESCE(_scheduled_at, now());
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ride_request:' || _uid::text));
  PERFORM public.expire_stale_immediate_requests(_uid);

  IF _idempotency_key IS NOT NULL THEN
    SELECT r.id INTO _existing FROM public.ride_requests r
    WHERE r.client_id = _uid AND r.idempotency_key = _idempotency_key;
    IF _existing IS NOT NULL THEN
      RETURN QUERY SELECT _existing, true, false, NULL::uuid; RETURN;
    END IF;
  END IF;

  -- Chauffeur hors service : aucune nouvelle course pour la journée en cours (Europe/Paris).
  SELECT d.on_duty INTO _on_duty FROM public.driver_profiles d WHERE d.user_id = _driver;
  IF COALESCE(_on_duty, false) = false
     AND (_when AT TIME ZONE 'Europe/Paris')::date = (now() AT TIME ZONE 'Europe/Paris')::date THEN
    RAISE EXCEPTION 'driver_unavailable_today';
  END IF;

  IF _immediate THEN
    SELECT b.request_id INTO _blocking FROM public.get_blocking_immediate_request() b;
    IF _blocking IS NOT NULL THEN
      RETURN QUERY SELECT NULL::uuid, false, true, _blocking; RETURN;
    END IF;
  END IF;

  IF _distance_km IS NOT NULL THEN
    SELECT * INTO _q FROM public.compute_ride_quote(_driver, _distance_km, COALESCE(_round_trip, false),
                                                    (COALESCE(_scheduled_at, now()))::date);
    _price := _q.amount_ttc;
  ELSE
    _price := _proposed_price;
  END IF;

  SELECT COALESCE(c.legal_name, d.business_name, p.full_name) INTO _legal_name
  FROM public.driver_profiles d
  JOIN public.profiles p ON p.id = d.user_id
  LEFT JOIN public.companies c ON c.driver_id = d.user_id
  WHERE d.user_id = _driver;

  INSERT INTO public.ride_requests (
    client_id, driver_id, pickup_address, dropoff_address, scheduled_at,
    passengers, luggage, comment, special_needs, round_trip, trip_type,
    proposed_price, status, is_immediate, idempotency_key, response_deadline,
    tax_regime, tax_vat_rate, amount_ht, vat_amount, amount_ttc,
    tax_vat_number, tax_legal_name, tax_legal_mention, tax_effective_from, tax_computed_at
  ) VALUES (
    _uid, _driver, _pickup, _dropoff, _scheduled_at,
    COALESCE(_passengers, 1), COALESCE(_luggage, 0), _comment, _special_needs,
    COALESCE(_round_trip, false), _trip_type, _price, 'new',
    COALESCE(_immediate, false), _idempotency_key,
    CASE WHEN COALESCE(_immediate, false) THEN now() + interval '10 minutes' END,
    _q.regime, _q.vat_rate, _q.amount_ht, _q.vat_amount, _q.amount_ttc,
    _q.vat_number, _legal_name, _q.legal_mention, _q.effective_from,
    CASE WHEN _q.amount_ttc IS NOT NULL THEN now() END
  )
  RETURNING id INTO _new;

  IF _cgu_version IS NOT NULL AND _cgv_version IS NOT NULL THEN
    INSERT INTO public.ride_request_terms_acceptances
      (user_id, request_id, cgu_version, cgv_version, cancellation_version)
    VALUES (_uid, _new, _cgu_version, _cgv_version, _cancellation_version);
  END IF;

  RETURN QUERY SELECT _new, false, false, NULL::uuid;
END; $function$;

-- Ancienne signature (sans distance) : même règle de blocage.
CREATE OR REPLACE FUNCTION public.create_client_ride_request(_driver uuid, _pickup text, _dropoff text, _scheduled_at timestamp with time zone, _passengers integer, _luggage integer, _comment text, _special_needs text, _round_trip boolean, _trip_type text, _proposed_price numeric, _immediate boolean, _idempotency_key text, _cgu_version text DEFAULT NULL::text, _cgv_version text DEFAULT NULL::text, _cancellation_version text DEFAULT NULL::text)
 RETURNS TABLE(request_id uuid, reused boolean, blocked boolean, blocking_request_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY SELECT * FROM public.create_client_ride_request(
    _driver, _pickup, _dropoff, _scheduled_at, _passengers, _luggage, _comment,
    _special_needs, _round_trip, _trip_type, _proposed_price, _immediate,
    _idempotency_key, _cgu_version, _cgv_version, _cancellation_version, NULL::numeric);
END; $function$;