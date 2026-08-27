CREATE OR REPLACE FUNCTION public.enforce_tariff_plan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _plan text;
BEGIN
  _plan := public.driver_plan(NEW.driver_id);

  IF _plan <> 'pro' THEN
    -- Version gratuite : seul le prix minimum est librement modifiable.
    NEW.price_per_km_ht := 1.85;
    NEW.pickup_pct := 0;
    NEW.night_enabled := false;
    NEW.night_pct := 0;
    NEW.night_start := COALESCE(OLD.night_start, NEW.night_start, '22:00'::time);
    NEW.night_end := COALESCE(OLD.night_end, NEW.night_end, '06:00'::time);
    NEW.minimum_ht := LEAST(GREATEST(COALESCE(NEW.minimum_ht, OLD.minimum_ht, 9), 0), 500);
    RETURN NEW;
  END IF;

  IF NEW.price_per_km_ht IS NULL OR NEW.price_per_km_ht <= 0 THEN
    RAISE EXCEPTION 'tariff_price_invalid';
  END IF;
  IF NEW.price_per_km_ht > 3.00 THEN
    RAISE EXCEPTION 'tariff_price_above_max';
  END IF;
  NEW.minimum_ht := LEAST(GREATEST(COALESCE(NEW.minimum_ht, 9), 0), 500);
  NEW.pickup_pct := LEAST(GREATEST(COALESCE(NEW.pickup_pct, 0), 0), 100);
  NEW.night_pct := LEAST(GREATEST(COALESCE(NEW.night_pct, 0), 0), 100);
  RETURN NEW;
END; $function$;