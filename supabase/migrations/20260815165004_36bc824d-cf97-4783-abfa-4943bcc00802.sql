CREATE TABLE public.driver_schedule_settings (
  driver_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  buffer_min integer NOT NULL DEFAULT 15 CHECK (buffer_min >= 0 AND buffer_min <= 240),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_schedule_settings TO authenticated;
GRANT ALL ON public.driver_schedule_settings TO service_role;
ALTER TABLE public.driver_schedule_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_owner_all" ON public.driver_schedule_settings FOR ALL TO authenticated
  USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());
CREATE POLICY "settings_admin_read" ON public.driver_schedule_settings FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE TRIGGER update_driver_schedule_settings_updated_at BEFORE UPDATE ON public.driver_schedule_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.driver_day_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  available boolean NOT NULL DEFAULT true,
  start_time time NOT NULL DEFAULT '08:00',
  end_time time NOT NULL DEFAULT '19:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, day),
  CHECK (end_time > start_time)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_day_overrides TO authenticated;
GRANT ALL ON public.driver_day_overrides TO service_role;
ALTER TABLE public.driver_day_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "overrides_owner_all" ON public.driver_day_overrides FOR ALL TO authenticated
  USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());
CREATE POLICY "overrides_admin_read" ON public.driver_day_overrides FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE TRIGGER update_driver_day_overrides_updated_at BEFORE UPDATE ON public.driver_day_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.driver_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date,
  weekday smallint CHECK (weekday BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CHECK (day IS NOT NULL OR weekday IS NOT NULL)
);
CREATE INDEX driver_breaks_driver_day_idx ON public.driver_breaks (driver_id, day);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_breaks TO authenticated;
GRANT ALL ON public.driver_breaks TO service_role;
ALTER TABLE public.driver_breaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "breaks_owner_all" ON public.driver_breaks FOR ALL TO authenticated
  USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());
CREATE POLICY "breaks_admin_read" ON public.driver_breaks FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE TRIGGER update_driver_breaks_updated_at BEFORE UPDATE ON public.driver_breaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fenêtre de travail effective d'un chauffeur pour une journée donnée.
CREATE OR REPLACE FUNCTION public.driver_day_window(_driver uuid, _day date)
RETURNS TABLE(defined boolean, available boolean, start_time time, end_time time)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ov AS (
    SELECT o.available, o.start_time, o.end_time
    FROM public.driver_day_overrides o
    WHERE o.driver_id = _driver AND o.day = _day
  ), ab AS (
    SELECT 1 FROM public.driver_absences a
    WHERE a.driver_id = _driver AND _day BETWEEN a.starts_on AND a.ends_on
  ), wh AS (
    SELECT h.active, h.start_time, h.end_time
    FROM public.driver_working_hours h
    WHERE h.driver_id = _driver AND h.weekday = EXTRACT(isodow FROM _day)::int
  )
  SELECT
    (EXISTS (SELECT 1 FROM ov) OR EXISTS (SELECT 1 FROM wh)) AS defined,
    CASE
      WHEN EXISTS (SELECT 1 FROM ab) THEN false
      WHEN EXISTS (SELECT 1 FROM ov) THEN (SELECT o.available FROM ov o)
      WHEN EXISTS (SELECT 1 FROM wh) THEN (SELECT w.active FROM wh w)
      ELSE true
    END AS available,
    COALESCE((SELECT o.start_time FROM ov o), (SELECT w.start_time FROM wh w), '00:00'::time) AS start_time,
    COALESCE((SELECT o.end_time FROM ov o), (SELECT w.end_time FROM wh w), '23:59'::time) AS end_time;
$$;
REVOKE ALL ON FUNCTION public.driver_day_window(uuid, date) FROM public;
GRANT EXECUTE ON FUNCTION public.driver_day_window(uuid, date) TO authenticated, service_role;

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

  -- Chauffeur hors service : aucune nouvelle course pour la journée en cours (Europe/Paris).
  SELECT d.on_duty INTO _on_duty FROM public.driver_profiles d WHERE d.user_id = _driver;
  IF COALESCE(_on_duty, false) = false
     AND (_when AT TIME ZONE 'Europe/Paris')::date = (now() AT TIME ZONE 'Europe/Paris')::date THEN
    RAISE EXCEPTION 'driver_unavailable_today';
  END IF;

  -- Prise de poste / fin de poste / pauses bloquantes (Europe/Paris).
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
    CASE WHEN _distance_km IS NOT NULL THEN now() END
  ) RETURNING id INTO _new;

  IF _cgu_version IS NOT NULL AND _cgv_version IS NOT NULL THEN
    INSERT INTO public.ride_request_terms_acceptances (user_id, request_id, cgu_version, cgv_version, cancellation_version)
    VALUES (_uid, _new, _cgu_version, _cgv_version, _cancellation_version);
  END IF;

  RETURN QUERY SELECT _new, false, false, NULL::uuid;
END; $function$;