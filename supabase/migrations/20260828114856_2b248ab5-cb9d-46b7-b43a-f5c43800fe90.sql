-- Règle centrale : une chauffeuse Woman for Woman n'est accessible qu'aux clientes déclarées femmes.
CREATE OR REPLACE FUNCTION public.wfw_relation_allowed(_client uuid, _driver uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.driver_profiles d
    WHERE d.user_id = _driver AND d.woman_for_woman
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _client AND p.gender = 'female'
  );
$$;

REVOKE ALL ON FUNCTION public.wfw_relation_allowed(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wfw_relation_allowed(uuid, uuid) TO authenticated, service_role;

-- Blocage de la relation client ↔ chauffeuse Woman for Woman
CREATE OR REPLACE FUNCTION public.guard_wfw_connection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.wfw_relation_allowed(NEW.client_id, NEW.driver_id) THEN
    RAISE EXCEPTION 'woman_for_woman_not_eligible';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_wfw_connection ON public.driver_client_connections;
CREATE TRIGGER guard_wfw_connection
BEFORE INSERT ON public.driver_client_connections
FOR EACH ROW EXECUTE FUNCTION public.guard_wfw_connection();

-- Demandes de course : même règle, quelle que soit l'option cochée
CREATE OR REPLACE FUNCTION public.guard_wfw_request_access()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NOT public.wfw_relation_allowed(NEW.client_id, NEW.driver_id) THEN
    RAISE EXCEPTION 'woman_for_woman_not_eligible';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_wfw_request_access ON public.ride_requests;
CREATE TRIGGER guard_wfw_request_access
BEFORE INSERT ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_wfw_request_access();

-- Estimation de prix
CREATE OR REPLACE FUNCTION public.compute_ride_quote(_driver uuid, _distance_km numeric, _round_trip boolean DEFAULT false, _at date DEFAULT CURRENT_DATE, _at_ts timestamp with time zone DEFAULT now())
 RETURNS TABLE(amount_ht numeric, vat_rate numeric, vat_amount numeric, amount_ttc numeric, regime text, rate_label text, vat_number text, legal_mention text, effective_from date, tax_configured boolean, tariff_confirmed boolean, price_per_km_ht numeric, minimum_ht numeric, base_ht numeric, rounding_ht numeric, plan text, km_amount numeric, pickup_pct numeric, pickup_amount numeric, night_applied boolean, night_pct numeric, night_amount numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ppk numeric := 1.85; _min numeric := 9; _basis text := 'unqualified';
  _pickup numeric := 0; _nen boolean := false; _ns time := '22:00'; _ne time := '06:00'; _npct numeric := 0;
  _plan text; _km numeric; _kmamount numeric; _base numeric; _pamount numeric := 0;
  _napplied boolean := false; _namount numeric := 0; _sub numeric; _ht numeric; _ltime time;
  _regime text := 'franchise'; _rate numeric; _label text; _vatnum text; _mention text;
  _eff date; _conf boolean := false;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NOT NULL AND _uid <> _driver
     AND NOT public.is_admin(_uid)
     AND NOT public.is_connected(_uid, _driver) THEN
    RAISE EXCEPTION 'driver_not_connected';
  END IF;

  IF _uid IS NOT NULL AND _uid <> _driver
     AND NOT public.is_admin(_uid)
     AND NOT public.wfw_relation_allowed(_uid, _driver) THEN
    RAISE EXCEPTION 'woman_for_woman_not_eligible';
  END IF;

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

-- Découverte : ne pas recommander une chauffeuse impossible à ajouter
CREATE OR REPLACE FUNCTION public.get_discover_drivers(_limit integer DEFAULT 20)
 RETURNS TABLE(user_id uuid, slug text, display_name text, full_name text, avatar_url text, city text, zone text, public_intro text, bio text, services text[], languages text[], long_distance boolean, airports text[], on_duty boolean, accepting_requests boolean, member_since timestamp with time zone, vehicle_brand text, vehicle_model text, vehicle_category text, vehicle_photo_url text, vehicle_interior_photo_url text, max_passengers integer, rating_avg numeric, rating_count bigint, woman_for_woman boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.user_id, d.slug,
         COALESCE(NULLIF(d.business_name, ''), p.full_name, 'Chauffeur'),
         p.full_name, p.avatar_url,
         d.city, d.zone, d.public_intro, d.bio,
         d.services, d.languages, d.long_distance, d.airports,
         d.on_duty, d.accepting_requests, d.created_at,
         v.brand, v.model, v.category, v.photo_url, v.photo_interior_url, v.max_passengers,
         r.rating_avg, COALESCE(r.rating_count, 0),
         d.woman_for_woman
  FROM public.driver_profiles d
  JOIN public.profiles p ON p.id = d.user_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.vehicles vv
    WHERE vv.driver_id = d.user_id
    ORDER BY vv.is_primary DESC, vv.created_at
    LIMIT 1
  ) v ON true
  LEFT JOIN LATERAL (
    SELECT round(avg(rr.rating)::numeric, 2) AS rating_avg, count(*) AS rating_count
    FROM public.ride_reviews rr
    WHERE rr.driver_id = d.user_id AND rr.status = 'visible'
  ) r ON true
  WHERE d.verification_status = 'verified'
    AND d.page_published
    AND auth.uid() IS NOT NULL
    AND d.user_id <> auth.uid()
    AND public.wfw_relation_allowed(auth.uid(), d.user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.driver_client_connections c
      WHERE c.client_id = auth.uid() AND c.driver_id = d.user_id
    )
  ORDER BY COALESCE(r.rating_avg, 0) DESC, COALESCE(r.rating_count, 0) DESC, d.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 50));
$function$;

CREATE OR REPLACE FUNCTION public.get_top10_drivers()
 RETURNS TABLE(rank_position integer, user_id uuid, slug text, display_name text, full_name text, avatar_url text, city text, zone text, public_intro text, bio text, services text[], languages text[], long_distance boolean, airports text[], on_duty boolean, accepting_requests boolean, member_since timestamp with time zone, vehicle_brand text, vehicle_model text, vehicle_category text, vehicle_photo_url text, vehicle_interior_photo_url text, max_passengers integer, price_per_km numeric, rating_avg numeric, rating_count bigint, already_connected boolean, woman_for_woman boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT t.rank_position, d.user_id, d.slug,
         COALESCE(NULLIF(d.business_name, ''), p.full_name, 'Chauffeur'),
         p.full_name, p.avatar_url,
         d.city, d.zone, d.public_intro, d.bio,
         d.services, d.languages, d.long_distance, d.airports,
         d.on_duty, d.accepting_requests, d.created_at,
         v.brand, v.model, v.category, v.photo_url, v.photo_interior_url, v.max_passengers,
         tar.price_per_km,
         r.rating_avg, COALESCE(r.rating_count, 0),
         false,
         d.woman_for_woman
  FROM public.top10_drivers t
  JOIN public.driver_profiles d ON d.user_id = t.driver_id
  JOIN public.profiles p ON p.id = d.user_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.vehicles vv
    WHERE vv.driver_id = d.user_id
    ORDER BY vv.is_primary DESC, vv.created_at
    LIMIT 1
  ) v ON true
  LEFT JOIN LATERAL (
    SELECT dt.price_per_km_ht AS price_per_km FROM public.driver_tariffs dt
    WHERE dt.driver_id = d.user_id
    ORDER BY dt.created_at DESC
    LIMIT 1
  ) tar ON true
  LEFT JOIN LATERAL (
    SELECT round(avg(rr.rating)::numeric, 2) AS rating_avg, count(*) AS rating_count
    FROM public.ride_reviews rr
    WHERE rr.driver_id = d.user_id AND rr.status = 'visible'
  ) r ON true
  WHERE auth.uid() IS NOT NULL
    AND d.verification_status = 'verified'
    AND d.page_published
    AND d.user_id <> auth.uid()
    AND public.wfw_relation_allowed(auth.uid(), d.user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.driver_client_connections c
      WHERE c.client_id = auth.uid() AND c.driver_id = d.user_id
    )
  ORDER BY t.rank_position;
$function$;