-- 1. Champs déclaratifs
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text
  CHECK (gender IS NULL OR gender IN ('female','male','undisclosed'));

ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS gender text
  CHECK (gender IS NULL OR gender IN ('female','male','undisclosed')),
  ADD COLUMN IF NOT EXISTS woman_for_woman boolean NOT NULL DEFAULT false;

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS woman_for_woman boolean NOT NULL DEFAULT false;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS woman_for_woman boolean NOT NULL DEFAULT false;

-- 2. Éligibilité
CREATE OR REPLACE FUNCTION public.woman_for_woman_eligible(_client uuid, _driver uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _client AND p.gender = 'female')
     AND EXISTS (
       SELECT 1 FROM public.driver_profiles d
       WHERE d.user_id = _driver AND d.gender = 'female' AND d.woman_for_woman
     );
$$;

REVOKE ALL ON FUNCTION public.woman_for_woman_eligible(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.woman_for_woman_eligible(uuid, uuid) TO authenticated, service_role;

-- 3. Désactivation automatique si le chauffeur n'est plus éligible
CREATE OR REPLACE FUNCTION public.guard_woman_for_woman_driver()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.gender, '') <> 'female' THEN
    NEW.woman_for_woman := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_woman_for_woman_driver ON public.driver_profiles;
CREATE TRIGGER trg_guard_woman_for_woman_driver
BEFORE INSERT OR UPDATE ON public.driver_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_woman_for_woman_driver();

-- 4. Contrôle serveur sur les demandes
CREATE OR REPLACE FUNCTION public.guard_woman_for_woman_request()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.woman_for_woman
     AND (
       TG_OP = 'INSERT'
       OR NEW.woman_for_woman IS DISTINCT FROM OLD.woman_for_woman
       OR (NEW.status IS DISTINCT FROM OLD.status
           AND NEW.status IN ('proposal_sent','awaiting_client','confirmed'))
     )
     AND NOT public.woman_for_woman_eligible(NEW.client_id, NEW.driver_id) THEN
    RAISE EXCEPTION 'woman_for_woman_not_eligible';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_woman_for_woman_request ON public.ride_requests;
CREATE TRIGGER trg_guard_woman_for_woman_request
BEFORE INSERT OR UPDATE ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_woman_for_woman_request();

-- 5. Contrôle serveur sur les courses (le drapeau est repris de la demande)
CREATE OR REPLACE FUNCTION public.guard_woman_for_woman_ride()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _flag boolean := false;
BEGIN
  IF NEW.request_id IS NOT NULL THEN
    SELECT r.woman_for_woman INTO _flag FROM public.ride_requests r WHERE r.id = NEW.request_id;
  END IF;
  NEW.woman_for_woman := COALESCE(_flag, false) OR COALESCE(NEW.woman_for_woman, false);

  IF NEW.woman_for_woman AND (
       NEW.client_id IS NULL
       OR NOT public.woman_for_woman_eligible(NEW.client_id, NEW.driver_id)
     ) THEN
    RAISE EXCEPTION 'woman_for_woman_not_eligible';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_woman_for_woman_ride ON public.rides;
CREATE TRIGGER trg_guard_woman_for_woman_ride
BEFORE INSERT ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.guard_woman_for_woman_ride();

-- 6. Création de demande avec l'option Woman for Woman
CREATE OR REPLACE FUNCTION public.create_client_ride_request(
  _driver uuid, _pickup text, _dropoff text, _scheduled_at timestamp with time zone,
  _passengers integer, _luggage integer, _comment text, _special_needs text,
  _round_trip boolean, _trip_type text, _proposed_price numeric, _immediate boolean,
  _idempotency_key text, _cgu_version text, _cgv_version text, _cancellation_version text,
  _distance_km numeric, _requirements jsonb, _payment_method text, _woman_for_woman boolean)
RETURNS TABLE(request_id uuid, reused boolean, blocked boolean, blocking_request_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_id uuid;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF COALESCE(_woman_for_woman, false)
     AND NOT public.woman_for_woman_eligible(_uid, _driver) THEN
    RAISE EXCEPTION 'woman_for_woman_not_eligible';
  END IF;

  SELECT r.request_id, r.reused, r.blocked, r.blocking_request_id
  INTO request_id, reused, blocked, blocking_request_id
  FROM public.create_client_ride_request(
    _driver, _pickup, _dropoff, _scheduled_at, _passengers, _luggage, _comment,
    _special_needs, _round_trip, _trip_type, _proposed_price, _immediate,
    _idempotency_key, _cgu_version, _cgv_version, _cancellation_version,
    _distance_km, _requirements, _payment_method
  ) r;

  new_id := request_id;
  IF new_id IS NOT NULL AND COALESCE(reused, false) = false AND COALESCE(blocked, false) = false
     AND COALESCE(_woman_for_woman, false) THEN
    UPDATE public.ride_requests SET woman_for_woman = true WHERE id = new_id;
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.create_client_ride_request(uuid, text, text, timestamptz, integer, integer, text, text, boolean, text, numeric, boolean, text, text, text, text, numeric, jsonb, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_client_ride_request(uuid, text, text, timestamptz, integer, integer, text, text, boolean, text, numeric, boolean, text, text, text, text, numeric, jsonb, text, boolean) TO authenticated, service_role;

-- 7. Exposition du service (jamais le genre) dans les lectures publiques
DROP FUNCTION IF EXISTS public.get_public_driver_page(text);
CREATE OR REPLACE FUNCTION public.get_public_driver_page(_slug text)
RETURNS TABLE(user_id uuid, slug text, business_name text, bio text, public_intro text, city text, zone text, service_areas text[], stations text[], airports text[], long_distance boolean, availability text[], booking_notice text, accepting_requests boolean, member_since timestamp with time zone, languages text[], services text[], full_name text, avatar_url text, vehicle_brand text, vehicle_model text, vehicle_color text, vehicle_year integer, vehicle_category text, vehicle_photo_url text, vehicle_interior_photo_url text, vehicle_front_photo_url text, vehicle_side_photo_url text, max_passengers integer, luggage_capacity integer, large_luggage_capacity integer, cabin_luggage_capacity integer, pets_policy text, pets_max integer, pets_carrier_required boolean, pets_conditions text, child_seat boolean, booster_seat boolean, stroller_space boolean, accessible boolean, large_trunk boolean, air_conditioning boolean, chargers boolean, water boolean, card_payment boolean, quiet_ride boolean, luggage_help boolean, pets_allowed boolean, company_verified boolean, verified_docs text[], public_phone text, whatsapp_number text, instagram_url text, facebook_url text, tiktok_url text, linkedin_url text, woman_for_woman boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT d.user_id, d.slug, d.business_name, d.bio, d.public_intro,
         d.city, d.zone, d.service_areas, d.stations, d.airports,
         d.long_distance, d.availability, d.booking_notice,
         d.accepting_requests, d.created_at,
         d.languages, d.services, p.full_name, p.avatar_url,
         v.brand, v.model, v.color, v.year, v.category, v.photo_url, v.photo_interior_url,
         v.photo_front_url, v.photo_side_url,
         v.max_passengers, v.luggage_capacity,
         v.large_luggage_capacity, v.cabin_luggage_capacity,
         v.pets_policy, v.pets_max, v.pets_carrier_required, v.pets_conditions,
         v.child_seat, v.booster_seat, v.stroller_space, v.accessible, v.large_trunk,
         v.air_conditioning, v.chargers, v.water, v.card_payment,
         v.quiet_ride, v.luggage_help, v.pets_allowed,
         EXISTS (SELECT 1 FROM public.companies c WHERE c.driver_id = d.user_id AND c.siret IS NOT NULL),
         COALESCE((
           SELECT array_agg(DISTINCT vd.doc_type)
           FROM public.verification_documents vd
           WHERE vd.driver_id = d.user_id AND vd.status = 'approved'
         ), '{}'),
         CASE WHEN d.show_public_phone THEN d.public_phone END,
         CASE WHEN d.show_whatsapp THEN d.whatsapp_number END,
         d.instagram_url, d.facebook_url, d.tiktok_url, d.linkedin_url,
         d.woman_for_woman
  FROM public.driver_profiles d
  JOIN public.profiles p ON p.id = d.user_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.vehicles vv
    WHERE vv.driver_id = d.user_id
    ORDER BY vv.is_primary DESC, vv.created_at
    LIMIT 1
  ) v ON true
  WHERE d.slug = _slug
    AND d.verification_status = 'verified'
    AND d.page_published;
$$;

DROP FUNCTION IF EXISTS public.get_connected_driver_profiles();
CREATE OR REPLACE FUNCTION public.get_connected_driver_profiles()
RETURNS TABLE(user_id uuid, slug text, business_name text, bio text, public_intro text, city text, zone text, service_areas text[], stations text[], airports text[], long_distance boolean, availability text[], booking_notice text, accepting_requests boolean, languages text[], services text[], on_duty boolean, page_published boolean, created_at timestamp with time zone, public_phone text, whatsapp_number text, instagram_url text, facebook_url text, tiktok_url text, linkedin_url text, woman_for_woman boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT d.user_id, d.slug, d.business_name, d.bio, d.public_intro,
         d.city, d.zone, d.service_areas, d.stations, d.airports,
         d.long_distance, d.availability, d.booking_notice,
         d.accepting_requests, d.languages, d.services, d.on_duty,
         d.page_published, d.created_at,
         CASE WHEN d.show_public_phone THEN d.public_phone END,
         CASE WHEN d.show_whatsapp THEN d.whatsapp_number END,
         d.instagram_url, d.facebook_url, d.tiktok_url, d.linkedin_url,
         d.woman_for_woman
  FROM public.driver_profiles d
  WHERE auth.uid() IS NOT NULL AND public.is_connected(auth.uid(), d.user_id);
$$;

DROP FUNCTION IF EXISTS public.get_discover_drivers(integer);
CREATE OR REPLACE FUNCTION public.get_discover_drivers(_limit integer DEFAULT 20)
RETURNS TABLE(user_id uuid, slug text, display_name text, full_name text, avatar_url text, city text, zone text, public_intro text, bio text, services text[], languages text[], long_distance boolean, airports text[], on_duty boolean, accepting_requests boolean, member_since timestamp with time zone, vehicle_brand text, vehicle_model text, vehicle_category text, vehicle_photo_url text, vehicle_interior_photo_url text, max_passengers integer, rating_avg numeric, rating_count bigint, woman_for_woman boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    AND NOT EXISTS (
      SELECT 1 FROM public.driver_client_connections c
      WHERE c.client_id = auth.uid() AND c.driver_id = d.user_id
    )
  ORDER BY COALESCE(r.rating_avg, 0) DESC, COALESCE(r.rating_count, 0) DESC, d.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 50));
$$;

DROP FUNCTION IF EXISTS public.get_top10_drivers();
CREATE OR REPLACE FUNCTION public.get_top10_drivers()
RETURNS TABLE(rank_position integer, user_id uuid, slug text, display_name text, full_name text, avatar_url text, city text, zone text, public_intro text, bio text, services text[], languages text[], long_distance boolean, airports text[], on_duty boolean, accepting_requests boolean, member_since timestamp with time zone, vehicle_brand text, vehicle_model text, vehicle_category text, vehicle_photo_url text, vehicle_interior_photo_url text, max_passengers integer, price_per_km numeric, rating_avg numeric, rating_count bigint, already_connected boolean, woman_for_woman boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    AND NOT EXISTS (
      SELECT 1 FROM public.driver_client_connections c
      WHERE c.client_id = auth.uid() AND c.driver_id = d.user_id
    )
  ORDER BY t.rank_position;
$$;