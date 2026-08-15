-- 1. Colonnes de type explicite
ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS ride_type text NOT NULL DEFAULT 'scheduled';
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS ride_type text NOT NULL DEFAULT 'scheduled';

-- 2. Reprise des données existantes
UPDATE public.ride_requests
   SET ride_type = CASE WHEN is_immediate THEN 'flash' ELSE 'scheduled' END;

UPDATE public.rides r
   SET ride_type = COALESCE(rq.ride_type, 'scheduled')
  FROM public.ride_requests rq
 WHERE rq.id = r.request_id;

-- 3. Contraintes
ALTER TABLE public.ride_requests
  DROP CONSTRAINT IF EXISTS ride_requests_ride_type_check;
ALTER TABLE public.ride_requests
  ADD CONSTRAINT ride_requests_ride_type_check CHECK (ride_type IN ('flash','scheduled'));

ALTER TABLE public.rides
  DROP CONSTRAINT IF EXISTS rides_ride_type_check;
ALTER TABLE public.rides
  ADD CONSTRAINT rides_ride_type_check CHECK (ride_type IN ('flash','scheduled'));

-- 4. Le type est dérivé une seule fois, à la création, et ne change plus ensuite
CREATE OR REPLACE FUNCTION public.set_ride_request_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.ride_type := CASE WHEN NEW.is_immediate THEN 'flash' ELSE 'scheduled' END;
  ELSE
    NEW.ride_type := OLD.ride_type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_ride_request_type ON public.ride_requests;
CREATE TRIGGER trg_set_ride_request_type
  BEFORE INSERT OR UPDATE ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_ride_request_type();

CREATE OR REPLACE FUNCTION public.set_ride_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.request_id IS NOT NULL THEN
      SELECT rq.ride_type INTO _type FROM public.ride_requests rq WHERE rq.id = NEW.request_id;
    END IF;
    NEW.ride_type := COALESCE(_type, 'scheduled');
  ELSE
    NEW.ride_type := OLD.ride_type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_ride_type ON public.rides;
CREATE TRIGGER trg_set_ride_type
  BEFORE INSERT OR UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.set_ride_type();

-- 5. Index de lecture
CREATE INDEX IF NOT EXISTS rides_driver_sched_idx
  ON public.rides (driver_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS ride_requests_driver_status_idx
  ON public.ride_requests (driver_id, status, scheduled_at);