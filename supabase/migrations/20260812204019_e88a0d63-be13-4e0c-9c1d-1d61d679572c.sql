-- 1. Colonnes de délai
ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS response_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

UPDATE public.ride_requests
  SET response_deadline = created_at + interval '10 minutes'
  WHERE is_immediate AND response_deadline IS NULL;

CREATE INDEX IF NOT EXISTS ride_requests_deadline_idx
  ON public.ride_requests (response_deadline)
  WHERE is_immediate AND response_deadline IS NOT NULL;

-- 2. Expiration serveur idempotente
CREATE OR REPLACE FUNCTION public.expire_stale_immediate_requests(_client uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.ride_requests r
     SET status = 'expired', expired_at = now()
   WHERE r.is_immediate
     AND r.status IN ('new','reviewing','proposal_sent','awaiting_client')
     AND r.response_deadline IS NOT NULL
     AND r.response_deadline <= now()
     AND (_client IS NULL OR r.client_id = _client)
     AND NOT EXISTS (SELECT 1 FROM public.rides ri WHERE ri.request_id = r.id);
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END; $$;

REVOKE ALL ON FUNCTION public.expire_stale_immediate_requests(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_immediate_requests(uuid) TO authenticated, service_role;

-- 3. Garde-fou : statuts terminaux + autorisation de l'expiration
CREATE OR REPLACE FUNCTION public.guard_ride_request_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Une demande terminée est figée : plus aucune acceptation possible.
  IF OLD.status IN ('expired','cancelled','refused','completed') THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'cette demande est terminée (%)', OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  NEW.client_id := OLD.client_id;
  NEW.driver_id := OLD.driver_id;

  IF auth.uid() = OLD.client_id THEN
    NEW.proposed_price := OLD.proposed_price;
    NEW.proposed_time := OLD.proposed_time;
    NEW.driver_message := OLD.driver_message;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('cancelled','confirmed','expired') THEN
      RAISE EXCEPTION 'status change not allowed for client';
    END IF;
  ELSIF auth.uid() = OLD.driver_id THEN
    NEW.pickup_address := OLD.pickup_address;
    NEW.dropoff_address := OLD.dropoff_address;
    NEW.scheduled_at := OLD.scheduled_at;
    NEW.passengers := OLD.passengers;
    NEW.luggage := OLD.luggage;
    NEW.round_trip := OLD.round_trip;
    NEW.trip_type := OLD.trip_type;
    NEW.special_needs := OLD.special_needs;
    NEW.comment := OLD.comment;
    NEW.preferred_contact := OLD.preferred_contact;
    -- Le délai appartient à la demande : le chauffeur ne peut pas le déplacer.
    NEW.response_deadline := OLD.response_deadline;
    NEW.expired_at := OLD.expired_at;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('reviewing','proposal_sent','awaiting_client','confirmed','refused','cancelled') THEN
      RAISE EXCEPTION 'status change not allowed for driver';
    END IF;
    -- Course immédiate : le délai serveur prime sur l'acceptation tardive.
    IF NEW.status IS DISTINCT FROM OLD.status
       AND OLD.is_immediate
       AND OLD.response_deadline IS NOT NULL
       AND OLD.response_deadline <= now() THEN
      RAISE EXCEPTION 'le délai de réponse de 10 minutes est dépassé';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

-- 4. Demande bloquante : expire d'abord les demandes périmées
DROP FUNCTION IF EXISTS public.get_blocking_immediate_request();

CREATE OR REPLACE FUNCTION public.get_blocking_immediate_request()
RETURNS TABLE(request_id uuid, ride_id uuid, status ride_status, kind text, driver_id uuid,
              driver_first_name text, created_at timestamptz, can_cancel boolean,
              response_deadline timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  PERFORM public.expire_stale_immediate_requests(_uid);

  RETURN QUERY
  WITH pending AS (
    SELECT r.id, NULL::uuid AS ride_id, r.status, 'request'::text AS kind,
           r.driver_id, r.created_at, true AS can_cancel, r.response_deadline
    FROM public.ride_requests r
    WHERE r.client_id = _uid
      AND r.is_immediate
      AND r.status IN ('new','reviewing','proposal_sent','awaiting_client')
    ORDER BY r.created_at DESC
    LIMIT 1
  ),
  active AS (
    SELECT COALESCE(rq.id, ride.id) AS id, ride.id AS ride_id, ride.status, 'ride'::text AS kind,
           ride.driver_id, ride.created_at, false AS can_cancel, NULL::timestamptz AS response_deadline
    FROM public.rides ride
    LEFT JOIN LATERAL (SELECT * FROM public.ride_requests q WHERE q.id = ride.request_id) rq ON true
    WHERE ride.client_id = _uid
      AND NOT ride.is_block
      AND ride.status IN ('confirmed','driver_enroute','driver_arrived','client_onboard','in_progress')
      AND (rq.id IS NULL OR rq.is_immediate)
      AND ride.scheduled_at <= now() + interval '2 hours'
    ORDER BY ride.created_at DESC
    LIMIT 1
  ),
  pick AS (
    SELECT * FROM pending
    UNION ALL
    SELECT * FROM active WHERE NOT EXISTS (SELECT 1 FROM pending)
  )
  SELECT p.id, p.ride_id, p.status, p.kind, p.driver_id,
         COALESCE(NULLIF(split_part(COALESCE(pr.full_name,''), ' ', 1), ''), 'votre chauffeur'),
         p.created_at, p.can_cancel, p.response_deadline
  FROM pick p
  LEFT JOIN public.profiles pr ON pr.id = p.driver_id;
END; $$;

REVOKE ALL ON FUNCTION public.get_blocking_immediate_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_blocking_immediate_request() TO authenticated, service_role;

-- 5. Création : expiration préalable + échéance serveur
CREATE OR REPLACE FUNCTION public.create_client_ride_request(_driver uuid, _pickup text, _dropoff text, _scheduled_at timestamptz, _passengers integer, _luggage integer, _comment text, _special_needs text, _round_trip boolean, _trip_type text, _proposed_price numeric, _immediate boolean, _idempotency_key text, _cgu_version text DEFAULT NULL, _cgv_version text DEFAULT NULL, _cancellation_version text DEFAULT NULL)
RETURNS TABLE(request_id uuid, reused boolean, blocked boolean, blocking_request_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _existing uuid;
  _blocking uuid;
  _new uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ride_request:' || _uid::text));
  PERFORM public.expire_stale_immediate_requests(_uid);

  IF _idempotency_key IS NOT NULL THEN
    SELECT r.id INTO _existing FROM public.ride_requests r
    WHERE r.client_id = _uid AND r.idempotency_key = _idempotency_key;
    IF _existing IS NOT NULL THEN
      RETURN QUERY SELECT _existing, true, false, NULL::uuid;
      RETURN;
    END IF;
  END IF;

  IF _immediate THEN
    SELECT b.request_id INTO _blocking FROM public.get_blocking_immediate_request() b;
    IF _blocking IS NOT NULL THEN
      RETURN QUERY SELECT NULL::uuid, false, true, _blocking;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.ride_requests (
    client_id, driver_id, pickup_address, dropoff_address, scheduled_at,
    passengers, luggage, comment, special_needs, round_trip, trip_type,
    proposed_price, status, is_immediate, idempotency_key, response_deadline
  ) VALUES (
    _uid, _driver, _pickup, _dropoff, _scheduled_at,
    COALESCE(_passengers, 1), COALESCE(_luggage, 0), _comment, _special_needs,
    COALESCE(_round_trip, false), _trip_type, _proposed_price, 'new',
    COALESCE(_immediate, false), _idempotency_key,
    CASE WHEN COALESCE(_immediate, false) THEN now() + interval '10 minutes' END
  )
  RETURNING id INTO _new;

  IF _cgu_version IS NOT NULL AND _cgv_version IS NOT NULL THEN
    INSERT INTO public.ride_request_terms_acceptances
      (user_id, request_id, cgu_version, cgv_version, cancellation_version)
    VALUES (_uid, _new, _cgu_version, _cgv_version, _cancellation_version);
  END IF;

  RETURN QUERY SELECT _new, false, false, NULL::uuid;
END; $$;

-- 6. Annulation : idempotente aussi sur une demande expirée
CREATE OR REPLACE FUNCTION public.cancel_client_ride_request(_request uuid)
RETURNS ride_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _status public.ride_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT r.status INTO _status FROM public.ride_requests r
  WHERE r.id = _request AND r.client_id = _uid FOR UPDATE;
  IF _status IS NULL THEN RAISE EXCEPTION 'request not found'; END IF;
  IF _status IN ('cancelled','refused','completed','expired') THEN RETURN _status; END IF;
  IF _status NOT IN ('new','reviewing','proposal_sent','awaiting_client') THEN
    RAISE EXCEPTION 'cancellation no longer allowed';
  END IF;
  UPDATE public.ride_requests SET status = 'cancelled' WHERE id = _request AND client_id = _uid;
  RETURN 'cancelled'::public.ride_status;
END; $$;

-- 7. Notification client à l'expiration
CREATE OR REPLACE FUNCTION public.notify_request_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (NEW.driver_id, 'Nouvelle demande de trajet',
            'Un client vous a envoyé une demande de trajet.', 'request', '/pro/demandes');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'expired' THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.client_id, 'Votre demande a expiré',
              'Le chauffeur n''a pas répondu dans le délai de 10 minutes. Vous pouvez effectuer une nouvelle demande.',
              'request', '/espace/suivi/' || NEW.id);
    ELSIF auth.uid() = NEW.client_id THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.driver_id, 'Demande mise à jour',
              'Le client a mis à jour sa demande.', 'request', '/pro/demandes');
    ELSE
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.client_id, 'Demande mise à jour',
              'Le statut de votre demande a changé : ' || NEW.status, 'request', '/espace/suivi/' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;