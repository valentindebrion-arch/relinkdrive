ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS payment_methods text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_method_label text,
  ADD COLUMN IF NOT EXISTS payment_method_chosen_at timestamptz;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS payment_method_label text;

CREATE OR REPLACE FUNCTION public.payment_method_label(_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _key
    WHEN 'cash' THEN 'Espèces'
    WHEN 'card' THEN 'Carte bancaire auprès du chauffeur'
    WHEN 'transfer' THEN 'Virement'
    WHEN 'invoice' THEN 'Sur facture'
    WHEN 'other' THEN 'Autre mode convenu avec le chauffeur'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.driver_payment_methods(_driver uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(d.payment_methods, '{}'::text[])
  FROM public.driver_profiles d
  WHERE d.user_id = _driver
$$;

REVOKE ALL ON FUNCTION public.driver_payment_methods(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_payment_methods(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.payment_method_label(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.payment_method_label(text) TO authenticated;

-- Création de demande : mode de règlement obligatoire et réellement accepté.
CREATE OR REPLACE FUNCTION public.create_client_ride_request(
  _driver uuid, _pickup text, _dropoff text, _scheduled_at timestamptz,
  _passengers integer, _luggage integer, _comment text, _special_needs text,
  _round_trip boolean, _trip_type text, _proposed_price numeric, _immediate boolean,
  _idempotency_key text, _cgu_version text, _cgv_version text, _cancellation_version text,
  _distance_km numeric, _requirements jsonb, _payment_method text)
RETURNS TABLE(request_id uuid, reused boolean, blocked boolean, blocking_request_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_id uuid;
  allowed text[];
  label text;
BEGIN
  IF _payment_method IS NULL OR btrim(_payment_method) = '' THEN
    RAISE EXCEPTION 'payment_method_required';
  END IF;

  allowed := public.driver_payment_methods(_driver);
  IF NOT (_payment_method = ANY (allowed)) THEN
    RAISE EXCEPTION 'payment_method_unavailable';
  END IF;

  label := public.payment_method_label(_payment_method);
  IF label IS NULL THEN
    RAISE EXCEPTION 'payment_method_unavailable';
  END IF;

  SELECT r.request_id, r.reused, r.blocked, r.blocking_request_id
  INTO request_id, reused, blocked, blocking_request_id
  FROM public.create_client_ride_request(
    _driver, _pickup, _dropoff, _scheduled_at, _passengers, _luggage, _comment,
    _special_needs, _round_trip, _trip_type, _proposed_price, _immediate,
    _idempotency_key, _cgu_version, _cgv_version, _cancellation_version,
    _distance_km, _requirements
  ) r;

  new_id := request_id;
  IF new_id IS NOT NULL AND COALESCE(reused, false) = false AND COALESCE(blocked, false) = false THEN
    UPDATE public.ride_requests SET
      payment_method = _payment_method,
      payment_method_label = label,
      payment_method_chosen_at = now()
    WHERE id = new_id;
  END IF;

  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_client_ride_request(uuid, text, text, timestamptz, integer, integer, text, text, boolean, text, numeric, boolean, text, text, text, text, numeric, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_client_ride_request(uuid, text, text, timestamptz, integer, integer, text, text, boolean, text, numeric, boolean, text, text, text, text, numeric, jsonb, text) TO authenticated;

-- Le mode de règlement appartient au client ; le chauffeur ne peut pas le modifier.
CREATE OR REPLACE FUNCTION public.guard_ride_request_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  allowed text[];
  label text;
BEGIN
  IF public.is_admin(auth.uid()) THEN RETURN NEW; END IF;

  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
    IF auth.uid() <> OLD.client_id THEN
      NEW.payment_method := OLD.payment_method;
      NEW.payment_method_label := OLD.payment_method_label;
      NEW.payment_method_chosen_at := OLD.payment_method_chosen_at;
      RETURN NEW;
    END IF;
    IF NEW.payment_method IS NULL THEN
      RAISE EXCEPTION 'payment_method_required';
    END IF;
    allowed := public.driver_payment_methods(OLD.driver_id);
    label := public.payment_method_label(NEW.payment_method);
    IF label IS NULL OR NOT (NEW.payment_method = ANY (allowed)) THEN
      RAISE EXCEPTION 'payment_method_unavailable';
    END IF;
    NEW.payment_method_label := label;
    NEW.payment_method_chosen_at := now();
  ELSE
    NEW.payment_method_label := OLD.payment_method_label;
    NEW.payment_method_chosen_at := OLD.payment_method_chosen_at;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ride_request_payment ON public.ride_requests;
CREATE TRIGGER trg_ride_request_payment
BEFORE UPDATE ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_ride_request_payment();

-- Le chauffeur est informé d'un changement de mode de règlement.
CREATE OR REPLACE FUNCTION public.notify_payment_method_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method AND NEW.payment_method IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (
      NEW.driver_id,
      'Mode de règlement modifié',
      'Le client a choisi : ' || COALESCE(NEW.payment_method_label, NEW.payment_method),
      'ride',
      '/pro/demandes'
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_payment_method_change ON public.ride_requests;
CREATE TRIGGER trg_notify_payment_method_change
AFTER UPDATE ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_payment_method_change();