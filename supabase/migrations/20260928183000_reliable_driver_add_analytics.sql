-- Un ajout au carnet est un événement métier confirmé par la base.
-- Le comptage ne dépend donc plus d'un second appel effectué par le navigateur.
CREATE OR REPLACE FUNCTION public.track_driver_connection_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _city text;
  _source text;
BEGIN
  SELECT city INTO _city
  FROM public.driver_profiles
  WHERE user_id = NEW.driver_id;

  _source := CASE
    WHEN NEW.source = 'qr_code' THEN 'qr'
    WHEN NEW.source = 'link' THEN 'direct'
    ELSE coalesce(nullif(NEW.source, ''), 'network')
  END;

  INSERT INTO public.analytics_events (
    event,
    driver_id,
    client_id,
    city,
    source,
    visitor_key,
    metadata
  ) VALUES (
    'driver_added',
    NEW.driver_id,
    NEW.client_id,
    _city,
    _source,
    NEW.client_id::text,
    jsonb_build_object('source', _source, 'connection_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_driver_connection_added
ON public.driver_client_connections;

CREATE TRIGGER trg_track_driver_connection_added
AFTER INSERT ON public.driver_client_connections
FOR EACH ROW
EXECUTE FUNCTION public.track_driver_connection_added();
