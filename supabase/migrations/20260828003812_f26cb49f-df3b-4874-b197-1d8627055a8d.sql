-- Les triggers système marquent leur insertion pour contourner le garde-fou anti-abus
CREATE OR REPLACE FUNCTION public.guard_notification_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_admin(auth.uid())
     OR coalesce(current_setting('relink.system_notification', true), '') = '1' THEN
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

-- Nouvelle demande de course : push système
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
    PERFORM set_config('relink.system_notification', '1', true);
    INSERT INTO public.notifications (user_id, title, body, kind, link, push)
    VALUES (NEW.driver_id, 'Nouvelle demande de course 🚗',
            nullif(trim(both ' ' from _from || ' → ' || _to), '→') || E'\n' || _when,
            'request', '/pro/demandes?demande=' || NEW.id, true);
    PERFORM set_config('relink.system_notification', '0', true);
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

-- Nouveau client : push système
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

  PERFORM set_config('relink.system_notification', '1', true);
  INSERT INTO public.notifications (user_id, title, body, kind, link, push)
  VALUES (
    NEW.driver_id,
    'Nouveau client 👋',
    CASE WHEN _first IS NULL
      THEN 'Un client vient de vous ajouter à ses chauffeurs.'
      ELSE _first || ' vient de vous ajouter à ses chauffeurs.'
    END,
    'connection',
    '/pro/clients?client=' || NEW.client_id,
    true
  );
  PERFORM set_config('relink.system_notification', '0', true);
  RETURN NEW;
END; $function$;