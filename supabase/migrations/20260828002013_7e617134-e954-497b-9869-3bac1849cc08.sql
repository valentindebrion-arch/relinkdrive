CREATE OR REPLACE FUNCTION public.notify_request_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _from text;
  _to text;
  _when text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Villes uniquement : pas d'adresse précise sur un écran verrouillé.
    _from := split_part(coalesce(NEW.pickup_address, ''), ',', 1);
    _to := split_part(coalesce(NEW.dropoff_address, ''), ',', 1);
    _when := CASE
      WHEN NEW.scheduled_at IS NULL THEN 'Départ : maintenant'
      ELSE 'Départ : ' || to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Paris', 'DD/MM à HH24:MI')
    END;
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (NEW.driver_id, 'Nouvelle demande de course 🚗',
            nullif(trim(both ' ' from _from || ' → ' || _to), '→') || E'\n' || _when,
            'request', '/pro/demandes');
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
$$;