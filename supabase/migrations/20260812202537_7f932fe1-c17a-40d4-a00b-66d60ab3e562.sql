ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS is_immediate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS ride_requests_client_idempotency_uidx
  ON public.ride_requests (client_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Une seule demande immédiate non traitée par client (garde-fou atomique).
CREATE UNIQUE INDEX IF NOT EXISTS ride_requests_one_pending_immediate_uidx
  ON public.ride_requests (client_id)
  WHERE is_immediate AND status IN ('new','reviewing','proposal_sent','awaiting_client');

CREATE OR REPLACE FUNCTION public.get_blocking_immediate_request()
RETURNS TABLE(
  request_id uuid,
  ride_id uuid,
  status public.ride_status,
  kind text,
  driver_id uuid,
  driver_first_name text,
  created_at timestamp with time zone,
  can_cancel boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  pending AS (
    SELECT r.id, NULL::uuid AS ride_id, r.status, 'request'::text AS kind,
           r.driver_id, r.created_at, true AS can_cancel
    FROM public.ride_requests r, me
    WHERE r.client_id = me.uid
      AND r.is_immediate
      AND r.status IN ('new','reviewing','proposal_sent','awaiting_client')
    ORDER BY r.created_at DESC
    LIMIT 1
  ),
  active AS (
    SELECT COALESCE(rq.id, ride.id) AS id, ride.id AS ride_id, ride.status, 'ride'::text AS kind,
           ride.driver_id, ride.created_at, false AS can_cancel
    FROM public.rides ride, me
    LEFT JOIN LATERAL (SELECT * FROM public.ride_requests q WHERE q.id = ride.request_id) rq ON true
    WHERE ride.client_id = me.uid
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
         p.created_at, p.can_cancel
  FROM pick p
  LEFT JOIN public.profiles pr ON pr.id = p.driver_id;
$$;

REVOKE ALL ON FUNCTION public.get_blocking_immediate_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_blocking_immediate_request() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_client_ride_request(
  _driver uuid,
  _pickup text,
  _dropoff text,
  _scheduled_at timestamp with time zone,
  _passengers integer,
  _luggage integer,
  _comment text,
  _special_needs text,
  _round_trip boolean,
  _trip_type text,
  _proposed_price numeric,
  _immediate boolean,
  _idempotency_key text,
  _cgu_version text DEFAULT NULL,
  _cgv_version text DEFAULT NULL,
  _cancellation_version text DEFAULT NULL
)
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

  -- Sérialise les créations concurrentes du même client.
  PERFORM pg_advisory_xact_lock(hashtext('ride_request:' || _uid::text));

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
    proposed_price, status, is_immediate, idempotency_key
  ) VALUES (
    _uid, _driver, _pickup, _dropoff, _scheduled_at,
    COALESCE(_passengers, 1), COALESCE(_luggage, 0), _comment, _special_needs,
    COALESCE(_round_trip, false), _trip_type, _proposed_price, 'new',
    COALESCE(_immediate, false), _idempotency_key
  )
  RETURNING id INTO _new;

  IF _cgu_version IS NOT NULL AND _cgv_version IS NOT NULL THEN
    INSERT INTO public.ride_request_terms_acceptances
      (user_id, request_id, cgu_version, cgv_version, cancellation_version)
    VALUES (_uid, _new, _cgu_version, _cgv_version, _cancellation_version);
  END IF;

  RETURN QUERY SELECT _new, false, false, NULL::uuid;
END;
$$;

REVOKE ALL ON FUNCTION public.create_client_ride_request(uuid,text,text,timestamptz,integer,integer,text,text,boolean,text,numeric,boolean,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_client_ride_request(uuid,text,text,timestamptz,integer,integer,text,text,boolean,text,numeric,boolean,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_client_ride_request(_request uuid)
RETURNS public.ride_status
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
  -- Idempotent : une demande déjà annulée renvoie simplement son statut.
  IF _status IN ('cancelled','refused','completed') THEN RETURN _status; END IF;
  IF _status NOT IN ('new','reviewing','proposal_sent','awaiting_client') THEN
    RAISE EXCEPTION 'cancellation no longer allowed';
  END IF;
  UPDATE public.ride_requests SET status = 'cancelled' WHERE id = _request AND client_id = _uid;
  RETURN 'cancelled'::public.ride_status;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_client_ride_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_client_ride_request(uuid) TO authenticated;