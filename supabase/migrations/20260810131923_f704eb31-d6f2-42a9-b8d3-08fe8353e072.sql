CREATE TABLE public.driver_working_hours (
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  active boolean NOT NULL DEFAULT true,
  start_time time NOT NULL DEFAULT '08:00',
  end_time time NOT NULL DEFAULT '19:00',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (driver_id, weekday),
  CHECK (start_time < end_time)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_working_hours TO authenticated;
GRANT ALL ON public.driver_working_hours TO service_role;
ALTER TABLE public.driver_working_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Driver manages own working hours"
  ON public.driver_working_hours FOR ALL TO authenticated
  USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Admins read working hours"
  ON public.driver_working_hours FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE public.driver_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);

CREATE INDEX idx_driver_absences_driver ON public.driver_absences (driver_id, starts_on, ends_on);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_absences TO authenticated;
GRANT ALL ON public.driver_absences TO service_role;
ALTER TABLE public.driver_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Driver manages own absences"
  ON public.driver_absences FOR ALL TO authenticated
  USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Admins read absences"
  ON public.driver_absences FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_working_hours_updated BEFORE UPDATE ON public.driver_working_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_absences_updated BEFORE UPDATE ON public.driver_absences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.driver_available_between(_driver uuid, _start timestamptz, _end timestamptz)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tz constant text := 'Europe/Paris';
  _s timestamp := (_start AT TIME ZONE _tz);
  _e timestamp := (_end AT TIME ZONE _tz);
  _d date;
  _row public.driver_working_hours%ROWTYPE;
BEGIN
  IF _e < _s THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.driver_working_hours w WHERE w.driver_id = _driver) THEN
    RETURN true;
  END IF;
  _d := _s::date;
  WHILE _d <= _e::date LOOP
    IF EXISTS (
      SELECT 1 FROM public.driver_absences a
      WHERE a.driver_id = _driver AND _d BETWEEN a.starts_on AND a.ends_on
    ) THEN
      RETURN false;
    END IF;
    SELECT * INTO _row FROM public.driver_working_hours w
      WHERE w.driver_id = _driver AND w.weekday = EXTRACT(isodow FROM _d)::int;
    IF _row.driver_id IS NULL OR NOT _row.active THEN RETURN false; END IF;
    IF greatest(_s, _d::timestamp) < (_d::timestamp + _row.start_time) THEN RETURN false; END IF;
    IF least(_e, (_d + 1)::timestamp) > (_d::timestamp + _row.end_time) THEN RETURN false; END IF;
    _d := _d + 1;
  END LOOP;
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.driver_available_between(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_available_between(uuid, timestamptz, timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_ride_request_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.scheduled_at IS NOT DISTINCT FROM OLD.scheduled_at THEN
    RETURN NEW;
  END IF;
  IF NOT public.driver_available_between(NEW.driver_id, NEW.scheduled_at, NEW.scheduled_at) THEN
    RAISE EXCEPTION 'Ce chauffeur n''est pas disponible à la date ou à l''horaire sélectionné.';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_guard_ride_request_availability
  BEFORE INSERT OR UPDATE ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_ride_request_availability();