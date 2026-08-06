CREATE OR REPLACE FUNCTION public.notify_new_connection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, kind, link)
  VALUES (NEW.driver_id, 'Nouveau client fidélisé',
          'Un client vient de vous ajouter à son carnet.', 'connection', '/pro/clients');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_connection ON public.driver_client_connections;
CREATE TRIGGER trg_notify_new_connection
AFTER INSERT ON public.driver_client_connections
FOR EACH ROW EXECUTE FUNCTION public.notify_new_connection();

REVOKE EXECUTE ON FUNCTION public.notify_new_connection() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_push_notification() FROM anon, authenticated;