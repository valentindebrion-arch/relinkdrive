ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS push boolean NOT NULL DEFAULT false;

-- Push uniquement pour les notifications explicitement marquées
CREATE OR REPLACE FUNCTION public.dispatch_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _prefs jsonb;
  _kind text := coalesce(NEW.kind, 'info');
BEGIN
  IF NEW.push IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT p.notification_prefs INTO _prefs
  FROM public.profiles p
  WHERE p.id = NEW.user_id AND p.push_enabled;

  IF _prefs IS NULL THEN
    RETURN NEW;
  END IF;

  IF coalesce((_prefs ->> _kind)::boolean, true) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = NEW.user_id) THEN
    PERFORM net.http_post(
      url := 'https://project--0a557f28-6d76-49a6-8ccb-45eeb9c28573.lovable.app/api/public/push',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-push-secret', 'ee259325c36893a39048dfc7a270347def2f13d161794a96'),
      body := jsonb_build_object('notification_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Déduplication : même destinataire, même titre, même lien dans les 5 dernières minutes
CREATE OR REPLACE FUNCTION public.dedupe_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = NEW.user_id
      AND n.title = NEW.title
      AND coalesce(n.link, '') = coalesce(NEW.link, '')
      AND n.created_at > now() - interval '5 minutes'
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS dedupe_notification_before_insert ON public.notifications;
CREATE TRIGGER dedupe_notification_before_insert
BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.dedupe_notification();

-- Nouveau client : prénom si disponible, push activé, lien vers le carnet clients
CREATE OR REPLACE FUNCTION public.notify_new_connection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _first text;
BEGIN
  SELECT nullif(split_part(trim(coalesce(p.full_name, '')), ' ', 1), '')
    INTO _first
  FROM public.profiles p
  WHERE p.id = NEW.client_id;

  INSERT INTO public.notifications (user_id, title, body, kind, link, push)
  VALUES (
    NEW.driver_id,
    'Nouveau client 👋',
    CASE WHEN _first IS NULL
      THEN 'Un client vient de vous ajouter à ses chauffeurs.'
      ELSE _first || ' vient de vous ajouter à ses chauffeurs.'
    END,
    'connection',
    '/pro/clients',
    true
  );
  RETURN NEW;
END; $function$;

-- Pas de push pour le mode de règlement (notification conservée dans l'app)
CREATE OR REPLACE FUNCTION public.notify_payment_method_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method AND NEW.payment_method IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, kind, link, push)
    VALUES (
      NEW.driver_id,
      'Mode de règlement modifié',
      'Le client a choisi : ' || COALESCE(NEW.payment_method_label, NEW.payment_method),
      'ride',
      '/pro/demandes',
      false
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Nouvelle demande : push + lien direct vers la demande concernée
CREATE OR REPLACE FUNCTION public.notify_request_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _from text;
  _to text;
  _when text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _from := split_part(coalesce(NEW.pickup_address, ''), ',', 1);
    _to := split_part(coalesce(NEW.dropoff_address, ''), ',', 1);
    _when := CASE
      WHEN NEW.scheduled_at IS NULL THEN 'Départ : maintenant'
      ELSE 'Départ : ' || to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Paris', 'DD/MM à HH24:MI')
    END;
    INSERT INTO public.notifications (user_id, title, body, kind, link, push)
    VALUES (NEW.driver_id, 'Nouvelle demande de course 🚗',
            nullif(trim(both ' ' from _from || ' → ' || _to), '→') || E'\n' || _when,
            'request', '/pro/demandes?demande=' || NEW.id, true);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'expired' THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.client_id, 'Votre demande a expiré',
              'Le chauffeur n''a pas répondu dans le délai de 10 minutes. Vous pouvez effectuer une nouvelle demande.',
              'request', '/espace/suivi/' || NEW.id);
    ELSIF NEW.status = 'cancelled' AND auth.uid() = NEW.client_id THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.driver_id, 'Une course a été annulée',
              'Le client a annulé sa demande.', 'request', '/pro/demandes');
    ELSIF auth.uid() = NEW.client_id THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.driver_id, 'Une course a été modifiée',
              'Le client a mis à jour sa demande.', 'request', '/pro/demandes');
    ELSE
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.client_id, 'Demande mise à jour',
              'Le statut de votre demande a changé : ' || NEW.status, 'request', '/espace/suivi/' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Un utilisateur non-admin ne peut pas s'auto-attribuer un push
CREATE OR REPLACE FUNCTION public.guard_notification_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.kind IS NULL OR NEW.kind NOT IN ('connection','request','ride','invoice','info') THEN
    RAISE EXCEPTION 'invalid notification kind';
  END IF;
  IF NEW.link IS NOT NULL AND NEW.link !~ '^/[A-Za-z0-9/_\-\?=&\.]*$' THEN
    RAISE EXCEPTION 'invalid notification link';
  END IF;
  NEW.push := false;
  RETURN NEW;
END; $function$;