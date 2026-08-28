CREATE OR REPLACE FUNCTION public.guard_driver_on_duty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verification_status <> 'verified' THEN
    IF COALESCE(NEW.on_duty, false) AND NOT COALESCE(OLD.on_duty, false) THEN
      RAISE EXCEPTION 'Votre dossier est en cours de vérification. Vous pourrez vous mettre disponible après validation par ReLink.';
    END IF;
    NEW.on_duty := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_driver_on_duty ON public.driver_profiles;
CREATE TRIGGER guard_driver_on_duty
BEFORE UPDATE ON public.driver_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_driver_on_duty();