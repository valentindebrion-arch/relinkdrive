ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications'; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

CREATE OR REPLACE FUNCTION public.notify_request_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (NEW.driver_id, 'Nouvelle demande de trajet', 'Un client vous a envoyé une demande de trajet.', 'request', '/pro/demandes');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (NEW.client_id, 'Demande mise à jour', 'Le statut de votre demande a changé : ' || NEW.status, 'request', '/espace/suivi/' || NEW.id);
    IF auth.uid() = NEW.client_id THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.driver_id, 'Demande mise à jour', 'Le client a mis à jour sa demande.', 'request', '/pro/demandes');
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_request_events ON public.ride_requests;
CREATE TRIGGER trg_notify_request_events
AFTER INSERT OR UPDATE ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_request_events();

CREATE OR REPLACE FUNCTION public.notify_ride_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (NEW.client_id, 'Course confirmée', 'Votre chauffeur a confirmé la course.', 'ride', '/espace/suivi/' || NEW.id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (NEW.client_id, 'Course mise à jour', 'Nouveau statut : ' || NEW.status, 'ride', '/espace/suivi/' || NEW.id);
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (NEW.driver_id, 'Course mise à jour', 'Nouveau statut : ' || NEW.status, 'ride', '/pro/courses');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_ride_events ON public.rides;
CREATE TRIGGER trg_notify_ride_events
AFTER INSERT OR UPDATE ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.notify_ride_events();

REVOKE EXECUTE ON FUNCTION public.notify_request_events() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_ride_events() FROM anon, authenticated;