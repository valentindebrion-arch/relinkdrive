-- 1. TARIFS CHAUFFEUR (HT)
CREATE TABLE public.driver_tariffs (
  driver_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  price_per_km_ht numeric(10,2) NOT NULL DEFAULT 1.90 CHECK (price_per_km_ht >= 0 AND price_per_km_ht <= 1000),
  minimum_ht numeric(10,2) NOT NULL DEFAULT 9 CHECK (minimum_ht >= 0 AND minimum_ht <= 10000),
  basis text NOT NULL DEFAULT 'unqualified' CHECK (basis IN ('ht','ttc','unqualified')),
  basis_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.driver_tariffs TO authenticated;
GRANT ALL ON public.driver_tariffs TO service_role;
ALTER TABLE public.driver_tariffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_tariffs_owner_all" ON public.driver_tariffs FOR ALL TO authenticated
  USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "driver_tariffs_admin_read" ON public.driver_tariffs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE TRIGGER driver_tariffs_updated_at BEFORE UPDATE ON public.driver_tariffs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. REGIMES DE TVA (historique, insert-only)
CREATE TABLE public.driver_tax_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  regime text NOT NULL CHECK (regime IN ('franchise','liable')),
  vat_rate numeric(5,2) CHECK (vat_rate > 0 AND vat_rate <= 100),
  rate_label text,
  vat_number text,
  legal_mention text,
  effective_from date NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_regime_coherent CHECK (
    (regime = 'liable' AND vat_rate IS NOT NULL AND vat_number IS NOT NULL)
    OR (regime = 'franchise' AND vat_rate IS NULL)
  )
);
CREATE INDEX driver_tax_profiles_driver_idx ON public.driver_tax_profiles (driver_id, effective_from DESC, created_at DESC);
GRANT SELECT, INSERT ON public.driver_tax_profiles TO authenticated;
GRANT ALL ON public.driver_tax_profiles TO service_role;
ALTER TABLE public.driver_tax_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax_profiles_owner_select" ON public.driver_tax_profiles FOR SELECT TO authenticated
  USING (auth.uid() = driver_id OR public.is_admin(auth.uid()));
CREATE POLICY "tax_profiles_owner_insert" ON public.driver_tax_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id AND created_by = auth.uid());

-- 3. TRACE DE MIGRATION DES TARIFS
CREATE TABLE public.driver_tariff_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_basis text NOT NULL,
  previous_price_per_km numeric(10,2),
  previous_minimum numeric(10,2),
  new_price_per_km_ht numeric(10,2) NOT NULL,
  new_minimum_ht numeric(10,2) NOT NULL,
  vat_rate numeric(5,2),
  decision text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.driver_tariff_migrations TO authenticated;
GRANT ALL ON public.driver_tariff_migrations TO service_role;
ALTER TABLE public.driver_tariff_migrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tariff_migrations_owner" ON public.driver_tariff_migrations FOR SELECT TO authenticated
  USING (auth.uid() = driver_id OR public.is_admin(auth.uid()));
CREATE POLICY "tariff_migrations_insert" ON public.driver_tariff_migrations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id);

-- 4. INSTANTANE FISCAL
ALTER TABLE public.ride_requests
  ADD COLUMN tax_regime text,
  ADD COLUMN tax_vat_rate numeric(5,2),
  ADD COLUMN amount_ht numeric(10,2),
  ADD COLUMN vat_amount numeric(10,2),
  ADD COLUMN amount_ttc numeric(10,2),
  ADD COLUMN tax_vat_number text,
  ADD COLUMN tax_legal_name text,
  ADD COLUMN tax_legal_mention text,
  ADD COLUMN tax_effective_from date,
  ADD COLUMN tax_computed_at timestamptz;

ALTER TABLE public.rides
  ADD COLUMN tax_regime text,
  ADD COLUMN tax_vat_rate numeric(5,2),
  ADD COLUMN amount_ht numeric(10,2),
  ADD COLUMN vat_amount numeric(10,2),
  ADD COLUMN amount_ttc numeric(10,2),
  ADD COLUMN tax_vat_number text,
  ADD COLUMN tax_legal_name text,
  ADD COLUMN tax_legal_mention text,
  ADD COLUMN tax_effective_from date,
  ADD COLUMN tax_computed_at timestamptz;

ALTER TABLE public.invoices
  ADD COLUMN tax_regime text,
  ADD COLUMN tax_legal_mention text,
  ADD COLUMN tax_vat_number text;

-- 5. REGIME APPLICABLE A UNE DATE
CREATE OR REPLACE FUNCTION public.driver_tax_at(_driver uuid, _at date DEFAULT current_date)
RETURNS TABLE(regime text, vat_rate numeric, rate_label text, vat_number text, legal_mention text, effective_from date, configured boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT t.regime, t.vat_rate, t.rate_label, t.vat_number,
         COALESCE(t.legal_mention, CASE WHEN t.regime = 'franchise' THEN 'TVA non applicable, art. 293 B du CGI' END),
         t.effective_from, true
  FROM public.driver_tax_profiles t
  WHERE t.driver_id = _driver AND t.effective_from <= _at
  ORDER BY t.effective_from DESC, t.created_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.driver_tax_at(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_tax_at(uuid, date) TO authenticated, service_role;

-- 6. DEVIS SERVEUR (prix client = TTC)
CREATE OR REPLACE FUNCTION public.compute_ride_quote(
  _driver uuid, _distance_km numeric, _round_trip boolean DEFAULT false, _at date DEFAULT current_date
)
RETURNS TABLE(
  amount_ht numeric, vat_rate numeric, vat_amount numeric, amount_ttc numeric,
  regime text, rate_label text, vat_number text, legal_mention text,
  effective_from date, tax_configured boolean, tariff_confirmed boolean,
  price_per_km_ht numeric, minimum_ht numeric, base_ht numeric, rounding_ht numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _ppk numeric := 1.90; _min numeric := 9; _basis text := 'unqualified';
  _km numeric; _base numeric; _ht numeric;
  _regime text := 'franchise'; _rate numeric; _label text; _vatnum text; _mention text;
  _eff date; _conf boolean := false;
BEGIN
  SELECT dt.price_per_km_ht, dt.minimum_ht, dt.basis INTO _ppk, _min, _basis
  FROM public.driver_tariffs dt WHERE dt.driver_id = _driver;
  _ppk := COALESCE(_ppk, 1.90); _min := COALESCE(_min, 9); _basis := COALESCE(_basis, 'unqualified');

  _km := GREATEST(COALESCE(_distance_km, 0), 0) * CASE WHEN COALESCE(_round_trip, false) THEN 2 ELSE 1 END;
  _base := GREATEST(_min, _km * _ppk);
  _ht := ceil(_base);

  SELECT x.regime, x.vat_rate, x.rate_label, x.vat_number, x.legal_mention, x.effective_from, x.configured
    INTO _regime, _rate, _label, _vatnum, _mention, _eff, _conf
  FROM public.driver_tax_at(_driver, _at) x;

  IF _regime IS NULL THEN
    _regime := 'franchise'; _conf := false;
    _mention := 'TVA non applicable, art. 293 B du CGI';
  END IF;

  IF _regime = 'liable' AND _rate IS NOT NULL THEN
    RETURN QUERY SELECT _ht, _rate, round(_ht * _rate / 100, 2), _ht + round(_ht * _rate / 100, 2),
      _regime, _label, _vatnum, _mention, _eff, COALESCE(_conf, false), (_basis = 'ht'),
      _ppk, _min, round(_base, 2), round(_ht - _base, 2);
  ELSE
    RETURN QUERY SELECT _ht, NULL::numeric, NULL::numeric, _ht,
      'franchise', NULL::text, NULL::text, _mention, _eff, COALESCE(_conf, false), (_basis = 'ht'),
      _ppk, _min, round(_base, 2), round(_ht - _base, 2);
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.compute_ride_quote(uuid, numeric, boolean, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_ride_quote(uuid, numeric, boolean, date) TO authenticated, service_role;

-- 7. CREATION DE DEMANDE : prix recalcule cote serveur + instantane fiscal
CREATE OR REPLACE FUNCTION public.create_client_ride_request(
  _driver uuid, _pickup text, _dropoff text, _scheduled_at timestamp with time zone,
  _passengers integer, _luggage integer, _comment text, _special_needs text,
  _round_trip boolean, _trip_type text, _proposed_price numeric, _immediate boolean,
  _idempotency_key text, _cgu_version text DEFAULT NULL::text, _cgv_version text DEFAULT NULL::text,
  _cancellation_version text DEFAULT NULL::text, _distance_km numeric DEFAULT NULL::numeric)
RETURNS TABLE(request_id uuid, reused boolean, blocked boolean, blocking_request_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _existing uuid; _blocking uuid; _new uuid;
  _q record; _legal_name text; _price numeric;
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

-- 8. FACTURE : instantane fiscal, jamais de TVA 0 % en franchise
CREATE OR REPLACE FUNCTION public.on_ride_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _number text; _status public.invoice_status; _completed int;
  _regime text; _rate numeric; _ht numeric; _vat numeric; _ttc numeric;
  _mention text; _vatnum text; _tax record;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' OR NEW.is_block THEN
    RETURN NEW;
  END IF;

  _regime := NEW.tax_regime; _rate := NEW.tax_vat_rate;
  _ht := NEW.amount_ht; _vat := NEW.vat_amount; _ttc := NEW.amount_ttc;
  _mention := NEW.tax_legal_mention; _vatnum := NEW.tax_vat_number;

  -- Courses anterieures a la gestion TVA : on reconstitue depuis le regime en vigueur a la date de la course
  IF _ttc IS NULL THEN
    SELECT * INTO _tax FROM public.driver_tax_at(NEW.driver_id, COALESCE(NEW.completed_at, now())::date);
    _regime := COALESCE(_tax.regime, 'franchise');
    _mention := COALESCE(_tax.legal_mention, 'TVA non applicable, art. 293 B du CGI');
    _vatnum := _tax.vat_number;
    _ttc := COALESCE(NEW.price, 0);
    IF _regime = 'liable' AND _tax.vat_rate IS NOT NULL THEN
      _rate := _tax.vat_rate;
      _ht := round(_ttc / (1 + _rate / 100), 2);
      _vat := round(_ttc - _ht, 2);
    ELSE
      _rate := NULL; _ht := _ttc; _vat := NULL;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE ride_id = NEW.id) THEN
    _number := 'F-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.invoice_number_seq')::text, 6, '0');
    _status := CASE WHEN _ttc > 0 AND NEW.client_id IS NOT NULL THEN 'issued'::public.invoice_status
                    ELSE 'draft'::public.invoice_status END;
    INSERT INTO public.invoices (
      ride_id, driver_id, client_id, number, issued_on, description,
      amount_ht, vat_rate, amount_ttc, status, payment_method, due_on, auto_generated,
      tax_regime, tax_legal_mention, tax_vat_number
    ) VALUES (
      NEW.id, NEW.driver_id, NEW.client_id, _number, current_date,
      'Course du ' || to_char(COALESCE(NEW.completed_at, now()), 'DD/MM/YYYY') || ' — ' ||
        NEW.pickup_address || ' → ' || NEW.dropoff_address,
      COALESCE(_ht, 0), COALESCE(_rate, 0), COALESCE(_ttc, 0), _status,
      NEW.payment_method, current_date + 30, true,
      COALESCE(_regime, 'franchise'), _mention, _vatnum
    );

    IF NEW.client_id IS NOT NULL AND _status = 'issued' THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.client_id, 'Votre facture est disponible',
              'Retrouvez le détail de votre course et votre facture.', 'invoice', '/espace/suivi/' || NEW.id);
    END IF;
  END IF;

  IF NEW.client_id IS NOT NULL THEN
    SELECT count(*) INTO _completed FROM public.rides
    WHERE driver_id = NEW.driver_id AND client_id = NEW.client_id AND status = 'completed';
    UPDATE public.driver_client_connections
      SET crm_status = CASE WHEN _completed >= 3 THEN 'regular'::public.crm_status ELSE 'active'::public.crm_status END
    WHERE driver_id = NEW.driver_id AND client_id = NEW.client_id;
  END IF;

  RETURN NEW;
END; $function$;