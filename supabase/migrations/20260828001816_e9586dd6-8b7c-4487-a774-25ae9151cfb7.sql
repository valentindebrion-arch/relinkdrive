ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT
  '{"request": true, "ride": true, "connection": true, "invoice": true, "info": false}'::jsonb;

CREATE OR REPLACE FUNCTION public.dispatch_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prefs jsonb;
  _kind text := coalesce(NEW.kind, 'info');
BEGIN
  SELECT p.notification_prefs INTO _prefs
  FROM public.profiles p
  WHERE p.id = NEW.user_id AND p.push_enabled;

  IF _prefs IS NULL THEN
    RETURN NEW;
  END IF;

  -- Une catégorie désactivée dans les réglages ne déclenche pas de push
  -- (la notification reste consultable dans le centre de notifications).
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
$$;