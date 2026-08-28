CREATE OR REPLACE FUNCTION public.dispatch_push_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _prefs jsonb;
  _kind text := coalesce(NEW.kind, 'info');
  _default boolean;
BEGIN
  -- Toute notification métier déclenche une push système : le pilotage se fait
  -- uniquement par les préférences de l'utilisateur, jamais par un drapeau
  -- interne susceptible d'être perdu selon le chemin d'insertion.
  IF NEW.title IS NULL OR btrim(NEW.title) = '' THEN
    RETURN NEW;
  END IF;

  SELECT p.notification_prefs INTO _prefs
  FROM public.profiles p
  WHERE p.id = NEW.user_id AND p.push_enabled;

  IF NOT FOUND THEN
    RAISE LOG '[push] % : push désactivée ou profil absent', NEW.id;
    RETURN NEW;
  END IF;

  -- Valeurs par défaut alignées sur l'application : « info » est facultatif,
  -- toutes les catégories opérationnelles sont actives par défaut.
  _default := (_kind <> 'info');

  IF coalesce((coalesce(_prefs, '{}'::jsonb) ->> _kind)::boolean, _default) IS NOT TRUE THEN
    RAISE LOG '[push] % : catégorie % désactivée', NEW.id, _kind;
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = NEW.user_id) THEN
    RAISE LOG '[push] % : envoi demandé (%).', NEW.id, _kind;
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
$function$;