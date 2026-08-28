CREATE OR REPLACE FUNCTION public.dispatch_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prefs jsonb;
  _kind text := coalesce(NEW.kind, 'info');
  _wants boolean;
BEGIN
  -- Une push est envoyée soit parce que la notification est marquée push,
  -- soit parce qu'il s'agit d'un des deux événements autorisés (demande de
  -- course, nouveau client) : le marquage peut être perdu selon le chemin
  -- d'insertion, l'événement métier reste la source de vérité.
  _wants := NEW.push IS TRUE
    OR (_kind = 'request' AND NEW.title ILIKE 'Nouvelle demande%')
    OR (_kind = 'connection' AND NEW.title ILIKE 'Nouveau client%');

  IF NOT _wants THEN
    RETURN NEW;
  END IF;

  SELECT p.notification_prefs INTO _prefs
  FROM public.profiles p
  WHERE p.id = NEW.user_id AND p.push_enabled;

  IF _prefs IS NULL THEN
    RAISE LOG '[push] % : push désactivée ou profil absent', NEW.id;
    RETURN NEW;
  END IF;

  IF coalesce((_prefs ->> _kind)::boolean, true) IS NOT TRUE THEN
    RAISE LOG '[push] % : catégorie % désactivée', NEW.id, _kind;
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = NEW.user_id) THEN
    RAISE LOG '[push] % : envoi demandé', NEW.id;
    PERFORM net.http_post(
      url := 'https://project--0a557f28-6d76-49a6-8ccb-45eeb9c28573.lovable.app/api/public/push',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-push-secret', 'ee259325c36893a39048dfc7a270347def2f13d161794a96'),
      body := jsonb_build_object('notification_id', NEW.id)
    );
  ELSE
    RAISE LOG '[push] % : aucun appareil abonné', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;