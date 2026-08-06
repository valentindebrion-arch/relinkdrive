CREATE OR REPLACE FUNCTION public.guard_notification_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.kind IS NULL OR NEW.kind NOT IN ('connection','request','ride','invoice','info') THEN
    RAISE EXCEPTION 'invalid notification kind';
  END IF;
  IF NEW.link IS NOT NULL AND NEW.link !~ '^/[A-Za-z0-9/_\-\?=&\.]*$' THEN
    RAISE EXCEPTION 'invalid notification link';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_notification_insert ON public.notifications;
CREATE TRIGGER trg_guard_notification_insert
BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.guard_notification_insert();

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

  -- immutable ownership
  NEW.client_id := OLD.client_id;
  NEW.driver_id := OLD.driver_id;

  IF auth.uid() = OLD.client_id THEN
    -- driver-only fields locked for the client
    NEW.proposed_price := OLD.proposed_price;
    NEW.proposed_time := OLD.proposed_time;
    NEW.driver_message := OLD.driver_message;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('cancelled','confirmed') THEN
      RAISE EXCEPTION 'status change not allowed for client';
    END IF;
  ELSIF auth.uid() = OLD.driver_id THEN
    -- client-only fields locked for the driver
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
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('reviewing','proposal_sent','awaiting_client','confirmed','refused','cancelled') THEN
      RAISE EXCEPTION 'status change not allowed for driver';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_ride_request_update ON public.ride_requests;
CREATE TRIGGER trg_guard_ride_request_update
BEFORE UPDATE ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_ride_request_update();

REVOKE ALL ON FUNCTION public.guard_notification_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_ride_request_update() FROM PUBLIC, anon, authenticated;