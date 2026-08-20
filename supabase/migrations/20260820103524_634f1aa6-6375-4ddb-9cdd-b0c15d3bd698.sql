CREATE OR REPLACE FUNCTION public.guard_driver_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.plan_started_at IS DISTINCT FROM OLD.plan_started_at
     OR NEW.plan_renews_at IS DISTINCT FROM OLD.plan_renews_at THEN
    IF NOT public.is_admin(auth.uid()) THEN
      NEW.plan := OLD.plan;
      NEW.plan_started_at := OLD.plan_started_at;
      NEW.plan_renews_at := OLD.plan_renews_at;
    END IF;
  END IF;

  -- Personnalisation (thème de réservation) : réservée au forfait Pro.
  IF NEW.booking_theme IS DISTINCT FROM OLD.booking_theme
     AND COALESCE(NEW.plan, OLD.plan, 'free') <> 'pro'
     AND NOT public.is_admin(auth.uid()) THEN
    NEW.booking_theme := OLD.booking_theme;
  END IF;

  RETURN NEW;
END; $function$;