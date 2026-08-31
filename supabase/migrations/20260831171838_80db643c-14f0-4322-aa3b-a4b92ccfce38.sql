ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender_correction_used boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_profile_gender_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Correction administrative (SAV) : toujours autorisée, sans consommer le quota.
  IF public.is_admin(auth.uid()) AND auth.uid() IS DISTINCT FROM NEW.id THEN
    RETURN NEW;
  END IF;

  IF NEW.gender IS DISTINCT FROM OLD.gender THEN
    IF OLD.gender IS NULL THEN
      -- Choix initial : ne compte pas comme la correction autorisée.
      NEW.gender_correction_used := OLD.gender_correction_used;
    ELSIF OLD.gender_correction_used THEN
      RAISE EXCEPTION 'gender_correction_used';
    ELSE
      NEW.gender_correction_used := true;
    END IF;
  ELSE
    NEW.gender_correction_used := OLD.gender_correction_used;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_driver_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _account_gender text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
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
  END IF;

  -- Source unique du sexe : le compte utilisateur.
  SELECT gender INTO _account_gender FROM public.profiles WHERE id = NEW.user_id;
  IF _account_gender IS NOT NULL THEN
    NEW.gender := _account_gender;
  END IF;

  -- Le style Woman for Woman est réservé aux profils explicitement féminins
  IF NEW.booking_theme = 'women_for_women' AND coalesce(NEW.gender, '') <> 'female' THEN
    NEW.booking_theme := 'relink_classic';
  END IF;

  -- Une seule logique : thème = mode
  NEW.woman_for_woman := (NEW.booking_theme = 'women_for_women');

  IF NEW.booking_theme IS DISTINCT FROM OLD.booking_theme THEN
    NEW.theme_updated_at := now();
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_my_gender(_gender text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _cur text;
  _used boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _gender IS NULL OR _gender NOT IN ('female', 'male', 'undisclosed') THEN
    RAISE EXCEPTION 'invalid_gender';
  END IF;

  SELECT gender, gender_correction_used INTO _cur, _used
  FROM public.profiles WHERE id = _uid FOR UPDATE;

  IF _cur IS NULL THEN
    UPDATE public.profiles SET gender = _gender WHERE id = _uid;
  ELSIF _cur = _gender THEN
    RETURN jsonb_build_object('gender', _cur, 'correction_used', _used, 'changed', false);
  ELSIF _used THEN
    RAISE EXCEPTION 'gender_correction_used';
  ELSE
    UPDATE public.profiles SET gender = _gender, gender_correction_used = true WHERE id = _uid;
  END IF;

  -- Le profil chauffeur suit immédiatement (mode et thème Woman for Woman inclus).
  UPDATE public.driver_profiles SET gender = _gender WHERE user_id = _uid;

  SELECT gender, gender_correction_used INTO _cur, _used
  FROM public.profiles WHERE id = _uid;

  RETURN jsonb_build_object('gender', _cur, 'correction_used', _used, 'changed', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_my_gender(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_my_gender(text) TO authenticated;