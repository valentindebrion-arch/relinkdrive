-- 1. Offre chauffeur
ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_renews_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.driver_profiles ADD CONSTRAINT driver_profiles_plan_check CHECK (plan IN ('free','pro'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.guard_driver_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.plan_started_at IS DISTINCT FROM OLD.plan_started_at
     OR NEW.plan_renews_at IS DISTINCT FROM OLD.plan_renews_at THEN
    IF NOT public.is_admin(auth.uid()) THEN
      NEW.plan := OLD.plan;
      NEW.plan_started_at := OLD.plan_started_at;
      NEW.plan_renews_at := OLD.plan_renews_at;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_driver_plan ON public.driver_profiles;
CREATE TRIGGER guard_driver_plan BEFORE UPDATE ON public.driver_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_driver_plan();

-- 2. Paramètres tarifaires avancés
ALTER TABLE public.driver_tariffs
  ADD COLUMN IF NOT EXISTS pickup_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS night_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS night_start time NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS night_end time NOT NULL DEFAULT '06:00',
  ADD COLUMN IF NOT EXISTS night_pct numeric NOT NULL DEFAULT 15;

CREATE OR REPLACE FUNCTION public.driver_plan(_driver uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT d.plan FROM public.driver_profiles d WHERE d.user_id = _driver), 'free');
$$;

REVOKE ALL ON FUNCTION public.driver_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_plan(uuid) TO authenticated, service_role;

-- Règles serveur : tarif imposé en Gratuit, plafonné en Pro
CREATE OR REPLACE FUNCTION public.enforce_tariff_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _plan text;
BEGIN
  _plan := public.driver_plan(NEW.driver_id);

  IF _plan <> 'pro' THEN
    NEW.price_per_km_ht := 1.85;
    NEW.pickup_pct := 0;
    NEW.night_enabled := false;
    NEW.minimum_ht := COALESCE(OLD.minimum_ht, NEW.minimum_ht, 9);
    RETURN NEW;
  END IF;

  IF NEW.price_per_km_ht IS NULL OR NEW.price_per_km_ht <= 0 THEN
    RAISE EXCEPTION 'tariff_price_invalid';
  END IF;
  IF NEW.price_per_km_ht > 3.00 THEN
    RAISE EXCEPTION 'tariff_price_above_max';
  END IF;
  NEW.pickup_pct := LEAST(GREATEST(COALESCE(NEW.pickup_pct, 0), 0), 100);
  NEW.night_pct := LEAST(GREATEST(COALESCE(NEW.night_pct, 0), 0), 100);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS enforce_tariff_plan ON public.driver_tariffs;
CREATE TRIGGER enforce_tariff_plan BEFORE INSERT OR UPDATE ON public.driver_tariffs
FOR EACH ROW EXECUTE FUNCTION public.enforce_tariff_plan();

-- Alignement des chauffeurs Gratuit existants sur le tarif ReLink
UPDATE public.driver_tariffs t
SET price_per_km_ht = 1.85, pickup_pct = 0, night_enabled = false
FROM public.driver_profiles d
WHERE d.user_id = t.driver_id AND d.plan <> 'pro';

-- 3. Devis : prise en charge + tarif de nuit
DROP FUNCTION IF EXISTS public.compute_ride_quote(uuid, numeric, boolean, date);

CREATE OR REPLACE FUNCTION public.compute_ride_quote(
  _driver uuid, _distance_km numeric, _round_trip boolean DEFAULT false,
  _at date DEFAULT CURRENT_DATE, _at_ts timestamptz DEFAULT now())
RETURNS TABLE(amount_ht numeric, vat_rate numeric, vat_amount numeric, amount_ttc numeric,
  regime text, rate_label text, vat_number text, legal_mention text, effective_from date,
  tax_configured boolean, tariff_confirmed boolean, price_per_km_ht numeric, minimum_ht numeric,
  base_ht numeric, rounding_ht numeric, plan text, km_amount numeric,
  pickup_pct numeric, pickup_amount numeric,
  night_applied boolean, night_pct numeric, night_amount numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _ppk numeric := 1.85; _min numeric := 9; _basis text := 'unqualified';
  _pickup numeric := 0; _nen boolean := false; _ns time := '22:00'; _ne time := '06:00'; _npct numeric := 0;
  _plan text; _km numeric; _kmamount numeric; _base numeric; _pamount numeric := 0;
  _napplied boolean := false; _namount numeric := 0; _sub numeric; _ht numeric; _ltime time;
  _regime text := 'franchise'; _rate numeric; _label text; _vatnum text; _mention text;
  _eff date; _conf boolean := false;
BEGIN
  _plan := public.driver_plan(_driver);

  SELECT dt.price_per_km_ht, dt.minimum_ht, dt.basis, dt.pickup_pct,
         dt.night_enabled, dt.night_start, dt.night_end, dt.night_pct
    INTO _ppk, _min, _basis, _pickup, _nen, _ns, _ne, _npct
  FROM public.driver_tariffs dt WHERE dt.driver_id = _driver;

  _min := COALESCE(_min, 9); _basis := COALESCE(_basis, 'unqualified');
  IF _plan = 'pro' THEN
    _ppk := LEAST(COALESCE(_ppk, 1.85), 3.00);
    _pickup := LEAST(GREATEST(COALESCE(_pickup, 0), 0), 100);
    _nen := COALESCE(_nen, false);
    _npct := LEAST(GREATEST(COALESCE(_npct, 0), 0), 100);
  ELSE
    _ppk := 1.85; _pickup := 0; _nen := false; _npct := 0;
  END IF;

  _km := GREATEST(COALESCE(_distance_km, 0), 0) * CASE WHEN COALESCE(_round_trip, false) THEN 2 ELSE 1 END;
  _kmamount := round(_km * _ppk, 2);
  _base := GREATEST(_min, _kmamount);

  _pamount := round(_base * _pickup / 100, 2);

  IF _nen THEN
    _ltime := (COALESCE(_at_ts, now()) AT TIME ZONE 'Europe/Paris')::time;
    IF _ns = _ne THEN
      _napplied := false;
    ELSIF _ns < _ne THEN
      _napplied := _ltime >= _ns AND _ltime < _ne;
    ELSE
      _napplied := _ltime >= _ns OR _ltime < _ne;
    END IF;
  END IF;
  IF _napplied THEN _namount := round(_base * _npct / 100, 2); END IF;

  _sub := _base + _pamount + _namount;
  _ht := ceil(_sub);

  SELECT x.regime, x.vat_rate, x.rate_label, x.vat_number, x.legal_mention, x.effective_from, x.configured
    INTO _regime, _rate, _label, _vatnum, _mention, _eff, _conf
  FROM public.driver_tax_at(_driver, _at) x;

  IF _regime IS NULL THEN
    _regime := 'franchise'; _conf := false;
    _mention := 'TVA non applicable, art. 293 B du CGI';
  END IF;

  IF _regime = 'liable' AND _rate IS NOT NULL THEN
    RETURN QUERY SELECT _ht, _rate, round(_ht * _rate / 100, 2), _ht + round(_ht * _rate / 100, 2),
      _regime, _label, _vatnum, _mention, _eff, COALESCE(_conf, false),
      (_basis = 'ht' OR _plan <> 'pro'),
      _ppk, _min, round(_sub, 2), round(_ht - _sub, 2), _plan, _kmamount,
      _pickup, _pamount, _napplied, _npct, _namount;
  ELSE
    RETURN QUERY SELECT _ht, NULL::numeric, NULL::numeric, _ht,
      'franchise', NULL::text, NULL::text, _mention, _eff, COALESCE(_conf, false),
      (_basis = 'ht' OR _plan <> 'pro'),
      _ppk, _min, round(_sub, 2), round(_ht - _sub, 2), _plan, _kmamount,
      _pickup, _pamount, _napplied, _npct, _namount;
  END IF;
END; $function$;

REVOKE ALL ON FUNCTION public.compute_ride_quote(uuid, numeric, boolean, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_ride_quote(uuid, numeric, boolean, date, timestamptz) TO authenticated, service_role;

-- 4. Courses planifiées réservées au Pro + horodatage du devis
CREATE OR REPLACE FUNCTION public.create_client_ride_request(
  _driver uuid, _pickup text, _dropoff text, _scheduled_at timestamp with time zone,
  _passengers integer, _luggage integer, _comment text, _special_needs text,
  _round_trip boolean, _trip_type text, _proposed_price numeric, _immediate boolean,
  _idempotency_key text, _cgu_version text DEFAULT NULL::text, _cgv_version text DEFAULT NULL::text,
  _cancellation_version text DEFAULT NULL::text, _distance_km numeric DEFAULT NULL::numeric)
RETURNS TABLE(request_id uuid, reused boolean, blocked boolean, blocking_request_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _uid uuid := auth.uid();
  _existing uuid; _blocking uuid; _new uuid;
  _q record; _legal_name text; _price numeric;
  _on_duty boolean; _when timestamptz := COALESCE(_scheduled_at, now());
  _w record; _local timestamp; _lday date; _ltime time; _buffer int;
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

  -- Courses planifiées : réservées aux chauffeurs ReLink Pro.
  IF COALESCE(_immediate, false) = false AND public.driver_plan(_driver) <> 'pro' THEN
    RAISE EXCEPTION 'driver_plan_scheduled_unavailable';
  END IF;

  SELECT d.on_duty INTO _on_duty FROM public.driver_profiles d WHERE d.user_id = _driver;
  IF COALESCE(_on_duty, false) = false
     AND (_when AT TIME ZONE 'Europe/Paris')::date = (now() AT TIME ZONE 'Europe/Paris')::date THEN
    RAISE EXCEPTION 'driver_unavailable_today';
  END IF;

  _local := _when AT TIME ZONE 'Europe/Paris';
  _lday := _local::date;
  _ltime := _local::time;
  SELECT * INTO _w FROM public.driver_day_window(_driver, _lday);
  IF _w.available = false THEN
    RAISE EXCEPTION 'driver_day_unavailable';
  END IF;
  IF _ltime < _w.start_time OR _ltime > _w.end_time THEN
    RAISE EXCEPTION 'driver_outside_working_hours';
  END IF;
  SELECT COALESCE(s.buffer_min, 15) INTO _buffer
  FROM public.driver_schedule_settings s WHERE s.driver_id = _driver;
  _buffer := COALESCE(_buffer, 15);
  IF EXISTS (
    SELECT 1 FROM public.driver_breaks b
    WHERE b.driver_id = _driver
      AND (b.day = _lday OR (b.day IS NULL AND b.weekday = EXTRACT(isodow FROM _lday)::int))
      AND _ltime < b.end_time
      AND (_ltime + make_interval(mins => _buffer))::time > b.start_time
  ) THEN
    RAISE EXCEPTION 'driver_break_conflict';
  END IF;

  IF _immediate THEN
    SELECT b.request_id INTO _blocking FROM public.get_blocking_immediate_request() b;
    IF _blocking IS NOT NULL THEN
      RETURN QUERY SELECT NULL::uuid, false, true, _blocking; RETURN;
    END IF;
  END IF;

  IF _distance_km IS NOT NULL THEN
    SELECT * INTO _q FROM public.compute_ride_quote(_driver, _distance_km, COALESCE(_round_trip, false),
                                                    (_when)::date, _when);
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
    CASE WHEN _distance_km IS NOT NULL THEN now() END
  ) RETURNING id INTO _new;

  IF _cgu_version IS NOT NULL AND _cgv_version IS NOT NULL THEN
    INSERT INTO public.ride_request_terms_acceptances (user_id, request_id, cgu_version, cgv_version, cancellation_version)
    VALUES (_uid, _new, _cgu_version, _cgv_version, _cancellation_version);
  END IF;

  RETURN QUERY SELECT _new, false, false, NULL::uuid;
END; $function$;