CREATE OR REPLACE FUNCTION public.notify_ride_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _label text; _title text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.client_id IS NOT NULL AND NOT NEW.is_block THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.client_id, 'Course confirmée',
              'Votre chauffeur a confirmé la course.', 'ride', '/espace/suivi/' || NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.client_id IS NOT NULL AND NOT NEW.is_block THEN
    -- 'driver_enroute' : informé par SMS manuel du chauffeur, pas d'alerte automatique (doublon).
    _label := CASE NEW.status
      WHEN 'driver_arrived' THEN 'Votre chauffeur est arrivé au point de rendez-vous.'
      WHEN 'client_onboard' THEN 'Vous êtes à bord, bonne route !'
      WHEN 'in_progress' THEN 'Votre course a démarré.'
      WHEN 'completed' THEN 'Votre course est terminée. Merci !'
      WHEN 'cancelled' THEN 'Votre course a été annulée.'
      ELSE NULL END;
    _title := CASE NEW.status
      WHEN 'driver_arrived' THEN 'Chauffeur arrivé'
      WHEN 'client_onboard' THEN 'Prise en charge'
      WHEN 'in_progress' THEN 'Course en cours'
      WHEN 'completed' THEN 'Course terminée'
      WHEN 'cancelled' THEN 'Course annulée'
      ELSE NULL END;
    IF _label IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.client_id, _title, _label, 'ride', '/espace/suivi/' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END; $function$