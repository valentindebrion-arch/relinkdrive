-- 1. Capacités détaillées du véhicule
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS large_luggage_capacity integer,
  ADD COLUMN IF NOT EXISTS cabin_luggage_capacity integer,
  ADD COLUMN IF NOT EXISTS pets_policy text NOT NULL DEFAULT 'refused',
  ADD COLUMN IF NOT EXISTS pets_max integer,
  ADD COLUMN IF NOT EXISTS pets_carrier_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pets_conditions text,
  ADD COLUMN IF NOT EXISTS booster_seat boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stroller_space boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS large_trunk boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_pets_policy_check') THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_pets_policy_check
      CHECK (pets_policy IN ('accepted', 'refused', 'conditional'));
  END IF;
END $$;

UPDATE public.vehicles SET pets_policy = 'accepted' WHERE pets_allowed AND pets_policy = 'refused';

-- 2. Besoins structurés côté client
ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS large_luggage integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cabin_luggage integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pets_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pet_type text,
  ADD COLUMN IF NOT EXISTS pet_carrier boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS equipment_needs text[] NOT NULL DEFAULT '{}';

-- 3. Capacités lisibles par un client connecté au chauffeur
CREATE OR REPLACE FUNCTION public.get_driver_vehicle_capacity(_driver uuid)
RETURNS TABLE (
  vehicle_id uuid,
  brand text,
  model text,
  max_passengers integer,
  luggage_capacity integer,
  large_luggage_capacity integer,
  cabin_luggage_capacity integer,
  pets_policy text,
  pets_max integer,
  pets_carrier_required boolean,
  pets_conditions text,
  child_seat boolean,
  booster_seat boolean,
  stroller_space boolean,
  accessible boolean,
  large_trunk boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.brand, v.model, v.max_passengers, v.luggage_capacity,
         v.large_luggage_capacity, v.cabin_luggage_capacity,
         v.pets_policy, v.pets_max, v.pets_carrier_required, v.pets_conditions,
         v.child_seat, v.booster_seat, v.stroller_space, v.accessible, v.large_trunk
  FROM public.vehicles v
  WHERE v.driver_id = _driver
    AND (
      auth.uid() = _driver
      OR public.is_admin(auth.uid())
      OR public.is_connected(auth.uid(), _driver)
    )
  ORDER BY v.is_primary DESC, v.created_at
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_driver_vehicle_capacity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_driver_vehicle_capacity(uuid) TO authenticated;

-- 4. Moteur de compatibilité centralisé
CREATE OR REPLACE FUNCTION public.check_ride_compatibility(_driver uuid, _req jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.vehicles%ROWTYPE;
  blocking jsonb := '[]'::jsonb;
  warnings jsonb := '[]'::jsonb;
  passengers integer := COALESCE((_req->>'passengers')::int, 1);
  large_l integer := COALESCE((_req->>'large_luggage')::int, 0);
  cabin_l integer := COALESCE((_req->>'cabin_luggage')::int, 0);
  total_l integer;
  pets integer := COALESCE((_req->>'pets_count')::int, 0);
  carrier boolean := COALESCE((_req->>'pet_carrier')::boolean, false);
  eq text;
  eq_list text[] := COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(_req->'equipment_needs', '[]'::jsonb))),
    '{}'::text[]
  );
BEGIN
  total_l := large_l + cabin_l;

  SELECT * INTO v FROM public.vehicles
  WHERE driver_id = _driver
  ORDER BY is_primary DESC, created_at
  LIMIT 1;

  IF v.id IS NULL THEN
    blocking := blocking || jsonb_build_object(
      'code', 'vehicle_missing', 'field', 'vehicle',
      'message', "left"('Les caractéristiques du véhicule de ce chauffeur ne sont pas encore renseignées. Contactez votre chauffeur avant de réserver.', 400));
    RETURN jsonb_build_object('compatible', false, 'blockingIssues', blocking, 'warnings', warnings);
  END IF;

  -- Passagers
  IF v.max_passengers IS NULL THEN
    blocking := blocking || jsonb_build_object(
      'code', 'passengers_unknown', 'field', 'passengers',
      'message', 'La capacité en passagers de ce véhicule n''a pas encore été renseignée. Contactez votre chauffeur avant de réserver.');
  ELSIF passengers > v.max_passengers THEN
    blocking := blocking || jsonb_build_object(
      'code', 'passengers_exceeded', 'field', 'passengers',
      'requestedValue', passengers, 'allowedValue', v.max_passengers,
      'message', format('Ce véhicule peut accueillir jusqu''à %s passagers. Vous avez indiqué %s passagers.', v.max_passengers, passengers));
  END IF;

  -- Bagages
  IF v.large_luggage_capacity IS NOT NULL OR v.cabin_luggage_capacity IS NOT NULL THEN
    IF v.large_luggage_capacity IS NOT NULL AND large_l > v.large_luggage_capacity THEN
      blocking := blocking || jsonb_build_object(
        'code', 'large_luggage_exceeded', 'field', 'large_luggage',
        'requestedValue', large_l, 'allowedValue', v.large_luggage_capacity,
        'message', format('La capacité déclarée de ce véhicule est de %s grands bagages. Vous en avez indiqué %s.', v.large_luggage_capacity, large_l));
    ELSIF v.large_luggage_capacity IS NULL AND large_l > 0 THEN
      blocking := blocking || jsonb_build_object(
        'code', 'large_luggage_unknown', 'field', 'large_luggage',
        'message', 'La capacité en grands bagages de ce véhicule n''a pas encore été renseignée. Contactez votre chauffeur avant de réserver.');
    END IF;
    IF v.cabin_luggage_capacity IS NOT NULL AND cabin_l > v.cabin_luggage_capacity THEN
      blocking := blocking || jsonb_build_object(
        'code', 'cabin_luggage_exceeded', 'field', 'cabin_luggage',
        'requestedValue', cabin_l, 'allowedValue', v.cabin_luggage_capacity,
        'message', format('La capacité déclarée de ce véhicule est de %s bagages cabine. Vous en avez indiqué %s.', v.cabin_luggage_capacity, cabin_l));
    ELSIF v.cabin_luggage_capacity IS NULL AND cabin_l > 0 THEN
      blocking := blocking || jsonb_build_object(
        'code', 'cabin_luggage_unknown', 'field', 'cabin_luggage',
        'message', 'La capacité en bagages cabine de ce véhicule n''a pas encore été renseignée. Contactez votre chauffeur avant de réserver.');
    END IF;
  ELSIF v.luggage_capacity IS NOT NULL THEN
    IF total_l > v.luggage_capacity THEN
      blocking := blocking || jsonb_build_object(
        'code', 'luggage_exceeded', 'field', 'luggage',
        'requestedValue', total_l, 'allowedValue', v.luggage_capacity,
        'message', format('La capacité déclarée de ce véhicule est de %s bagages. Vous en avez indiqué %s.', v.luggage_capacity, total_l));
    END IF;
  ELSIF total_l > 0 THEN
    blocking := blocking || jsonb_build_object(
      'code', 'luggage_unknown', 'field', 'luggage',
      'message', 'La capacité en bagages de ce véhicule n''a pas encore été renseignée. Contactez votre chauffeur avant de réserver.');
  END IF;

  -- Animaux
  IF pets > 0 THEN
    IF v.pets_policy = 'refused' THEN
      blocking := blocking || jsonb_build_object(
        'code', 'pets_refused', 'field', 'pets',
        'message', 'Ce chauffeur n''accepte pas les animaux à bord de ce véhicule.');
    ELSE
      IF v.pets_max IS NOT NULL AND pets > v.pets_max THEN
        blocking := blocking || jsonb_build_object(
          'code', 'pets_exceeded', 'field', 'pets',
          'requestedValue', pets, 'allowedValue', v.pets_max,
          'message', format('Ce chauffeur accepte jusqu''à %s animal(aux) à bord. Vous en avez indiqué %s.', v.pets_max, pets));
      END IF;
      IF v.pets_carrier_required AND NOT carrier THEN
        blocking := blocking || jsonb_build_object(
          'code', 'pets_carrier_required', 'field', 'pet_carrier',
          'message', 'Ce chauffeur accepte les animaux uniquement transportés dans une caisse ou un sac de transport.');
      END IF;
      IF v.pets_policy = 'conditional' AND COALESCE(v.pets_conditions, '') <> '' THEN
        warnings := warnings || jsonb_build_object(
          'code', 'pets_conditions', 'message', format('Conditions du chauffeur pour les animaux : %s', v.pets_conditions));
      END IF;
    END IF;
  END IF;

  -- Équipements
  FOREACH eq IN ARRAY eq_list LOOP
    IF eq = 'siege_enfant' AND NOT COALESCE(v.child_seat, false) THEN
      blocking := blocking || jsonb_build_object('code', 'equipment_missing', 'field', 'siege_enfant',
        'message', 'Le siège enfant demandé n''est pas disponible dans ce véhicule.');
    ELSIF eq = 'rehausseur' AND NOT COALESCE(v.booster_seat, false) THEN
      blocking := blocking || jsonb_build_object('code', 'equipment_missing', 'field', 'rehausseur',
        'message', 'Le rehausseur demandé n''est pas disponible dans ce véhicule.');
    ELSIF eq = 'poussette' AND NOT COALESCE(v.stroller_space, false) THEN
      blocking := blocking || jsonb_build_object('code', 'equipment_missing', 'field', 'poussette',
        'message', 'Ce véhicule ne dispose pas de l''espace nécessaire pour une poussette.');
    ELSIF eq IN ('fauteuil', 'accessibilite') AND NOT COALESCE(v.accessible, false) THEN
      blocking := blocking || jsonb_build_object('code', 'equipment_missing', 'field', eq,
        'message', 'Ce véhicule n''est pas équipé pour l''accessibilité en fauteuil roulant.');
    ELSIF eq = 'bagages_volumineux' AND NOT COALESCE(v.large_trunk, false) THEN
      blocking := blocking || jsonb_build_object('code', 'equipment_missing', 'field', 'bagages_volumineux',
        'message', 'Ce véhicule ne dispose pas d''un grand coffre pour des bagages volumineux.');
    ELSIF eq IN ('pancarte', 'autre') THEN
      warnings := warnings || jsonb_build_object('code', 'informative',
        'message', 'Cette demande est transmise au chauffeur à titre indicatif : il reste libre de l''accepter.');
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'compatible', jsonb_array_length(blocking) = 0,
    'blockingIssues', blocking,
    'warnings', warnings
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_ride_compatibility(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_ride_compatibility(uuid, jsonb) TO authenticated;

-- 5. Blocage serveur à la création d'une demande
CREATE OR REPLACE FUNCTION public.guard_ride_request_compatibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  result := public.check_ride_compatibility(NEW.driver_id, jsonb_build_object(
    'passengers', NEW.passengers,
    'large_luggage', NEW.large_luggage,
    'cabin_luggage', NEW.cabin_luggage,
    'pets_count', NEW.pets_count,
    'pet_carrier', NEW.pet_carrier,
    'equipment_needs', to_jsonb(NEW.equipment_needs)
  ));

  IF NOT (result->>'compatible')::boolean THEN
    RAISE EXCEPTION 'ride_incompatible: %', result::text
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ride_request_compatibility ON public.ride_requests;
CREATE TRIGGER trg_ride_request_compatibility
BEFORE INSERT OR UPDATE OF passengers, large_luggage, cabin_luggage, pets_count, pet_carrier, equipment_needs
ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_ride_request_compatibility();

-- 6. Prise en charge des besoins structurés dans la création de demande
CREATE OR REPLACE FUNCTION public.create_client_ride_request(
  _driver uuid, _pickup text, _dropoff text, _scheduled_at timestamptz,
  _passengers integer, _luggage integer, _comment text, _special_needs text,
  _round_trip boolean, _trip_type text, _proposed_price numeric, _immediate boolean,
  _idempotency_key text, _cgu_version text, _cgv_version text, _cancellation_version text,
  _distance_km numeric, _requirements jsonb
)
RETURNS TABLE(request_id uuid, reused boolean, blocked boolean, blocking_request_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  compat jsonb;
BEGIN
  compat := public.check_ride_compatibility(_driver, COALESCE(_requirements, '{}'::jsonb) || jsonb_build_object('passengers', _passengers));
  IF NOT (compat->>'compatible')::boolean THEN
    RAISE EXCEPTION 'ride_incompatible: %', compat::text USING ERRCODE = 'check_violation';
  END IF;

  SELECT r.request_id, r.reused, r.blocked, r.blocking_request_id
  INTO request_id, reused, blocked, blocking_request_id
  FROM public.create_client_ride_request(
    _driver, _pickup, _dropoff, _scheduled_at, _passengers, _luggage, _comment,
    _special_needs, _round_trip, _trip_type, _proposed_price, _immediate,
    _idempotency_key, _cgu_version, _cgv_version, _cancellation_version, _distance_km
  ) r;

  new_id := request_id;
  IF new_id IS NOT NULL AND COALESCE(reused, false) = false AND COALESCE(blocked, false) = false THEN
    UPDATE public.ride_requests SET
      large_luggage = COALESCE((_requirements->>'large_luggage')::int, 0),
      cabin_luggage = COALESCE((_requirements->>'cabin_luggage')::int, 0),
      pets_count = COALESCE((_requirements->>'pets_count')::int, 0),
      pet_type = NULLIF(_requirements->>'pet_type', ''),
      pet_carrier = COALESCE((_requirements->>'pet_carrier')::boolean, false),
      equipment_needs = COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(_requirements->'equipment_needs', '[]'::jsonb))), '{}'::text[])
    WHERE id = new_id;
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.create_client_ride_request(uuid, text, text, timestamptz, integer, integer, text, text, boolean, text, numeric, boolean, text, text, text, text, numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_client_ride_request(uuid, text, text, timestamptz, integer, integer, text, text, boolean, text, numeric, boolean, text, text, text, text, numeric, jsonb) TO authenticated;