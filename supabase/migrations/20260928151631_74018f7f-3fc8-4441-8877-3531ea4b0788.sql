ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS booking_theme_mode text NOT NULL DEFAULT 'auto'
  CHECK (booking_theme_mode IN ('auto','admin'));

-- Variante calculée à partir du véhicule principal (hors Woman for Woman).
CREATE OR REPLACE FUNCTION public.compute_vehicle_theme(_driver uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _t text;
BEGIN
  SELECT lower(coalesce(v.category,'') || ' ' || coalesce(v.brand,'') || ' ' || coalesce(v.model,''))
    INTO _t
  FROM public.vehicles v WHERE v.driver_id = _driver
  ORDER BY v.is_primary DESC, v.created_at LIMIT 1;
  _t := coalesce(_t, '');
  IF _t ~ '(électri|electri|hybrid|green)' THEN RETURN 'relink_classic';
  ELSIF _t ~ '\mvan\M' THEN RETURN 'professional_blue';
  ELSIF _t ~ '(sport|coupé|coupe)' THEN RETURN 'dynamic_red';
  ELSIF _t ~ '(luxe|premium|premi[eè]re classe|first)' THEN RETURN 'luxury_black_gold';
  END IF;
  RETURN 'relink_classic';
END $$;
REVOKE ALL ON FUNCTION public.compute_vehicle_theme(uuid) FROM PUBLIC, anon, authenticated;

-- Lecture de la variante automatique : le chauffeur lui-même ou un admin.
CREATE OR REPLACE FUNCTION public.get_driver_auto_theme(_driver uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _driver AND NOT public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN public.compute_vehicle_theme(_driver);
END $$;
REVOKE ALL ON FUNCTION public.get_driver_auto_theme(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_driver_auto_theme(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_driver_profile_admin_fields()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _account_gender text;
  _is_admin boolean := public.is_admin(auth.uid());
BEGIN
  IF NOT _is_admin THEN
    NEW.admin_note := OLD.admin_note;
    NEW.approved_at := OLD.approved_at;
    NEW.approved_by := OLD.approved_by;
    NEW.suspended_at := OLD.suspended_at;
    NEW.suspension_reason := OLD.suspension_reason;
    NEW.women_for_women_eligible := OLD.women_for_women_eligible;
    NEW.women_for_women_verified_at := OLD.women_for_women_verified_at;
    NEW.women_for_women_verified_by := OLD.women_for_women_verified_by;
    NEW.verification_status := OLD.verification_status;
    NEW.submitted_at := OLD.submitted_at;
    NEW.rejection_reason := OLD.rejection_reason;
    NEW.page_published := OLD.page_published;
    -- Dérogation manuelle du thème : réservée à l'administration
    NEW.booking_theme_mode := OLD.booking_theme_mode;
    IF OLD.booking_theme_mode = 'admin' THEN
      NEW.booking_theme := OLD.booking_theme;
    END IF;
  END IF;

  SELECT gender INTO _account_gender FROM public.profiles WHERE id = NEW.user_id;
  IF _account_gender IS NOT NULL THEN
    NEW.gender := _account_gender;
  END IF;

  IF NEW.booking_theme = 'women_for_women' AND coalesce(NEW.gender, '') <> 'female' THEN
    NEW.booking_theme := 'relink_classic';
  END IF;

  -- Attribution automatique selon le véhicule principal (WFW prioritaire).
  IF NEW.booking_theme_mode = 'auto' AND NEW.booking_theme IS DISTINCT FROM 'women_for_women' THEN
    NEW.booking_theme := public.compute_vehicle_theme(NEW.user_id);
  END IF;

  NEW.woman_for_woman := (NEW.booking_theme = 'women_for_women');

  IF NEW.booking_theme IS DISTINCT FROM OLD.booking_theme THEN
    NEW.theme_updated_at := now();
  END IF;

  RETURN NEW;
END;
$function$;

-- Recalcul quand le véhicule principal ou sa catégorie change.
CREATE OR REPLACE FUNCTION public.refresh_driver_auto_theme()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _driver uuid := coalesce(NEW.driver_id, OLD.driver_id);
BEGIN
  UPDATE public.driver_profiles
     SET booking_theme = public.compute_vehicle_theme(_driver)
   WHERE user_id = _driver
     AND booking_theme_mode = 'auto'
     AND booking_theme <> 'women_for_women'
     AND booking_theme IS DISTINCT FROM public.compute_vehicle_theme(_driver);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.refresh_driver_auto_theme() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vehicles_refresh_auto_theme ON public.vehicles;
CREATE TRIGGER vehicles_refresh_auto_theme
AFTER INSERT OR DELETE OR UPDATE OF category, is_primary, brand, model ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.refresh_driver_auto_theme();