CREATE OR REPLACE FUNCTION public.notify_counterparty(_recipient uuid, _kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _title text; _body text; _link text; _k text;
BEGIN
  IF auth.uid() IS NULL OR _recipient IS NULL OR _recipient = auth.uid() THEN
    RETURN;
  END IF;
  IF NOT (public.is_connected(auth.uid(), _recipient) OR public.is_connected(_recipient, auth.uid())) THEN
    RETURN;
  END IF;

  CASE _kind
    WHEN 'connection' THEN
      _title := 'Nouveau client fidélisé';
      _body := 'Un client vient de vous ajouter à son carnet.';
      _link := '/pro/clients'; _k := 'connection';
    WHEN 'request_new' THEN
      _title := 'Nouvelle demande de trajet';
      _body := 'Un client vous a envoyé une demande de trajet.';
      _link := '/pro/demandes'; _k := 'request';
    WHEN 'request_update' THEN
      _title := 'Demande mise à jour';
      _body := 'Le statut de votre demande a été mis à jour.';
      _link := '/espace/demandes'; _k := 'request';
    WHEN 'ride_update' THEN
      _title := 'Course mise à jour';
      _body := 'Le statut de votre course a été mis à jour.';
      _link := '/espace/courses'; _k := 'ride';
    ELSE
      RETURN;
  END CASE;

  INSERT INTO public.notifications (user_id, title, body, kind, link)
  VALUES (_recipient, _title, _body, _k, _link);
END; $$;

REVOKE ALL ON FUNCTION public.notify_counterparty(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_counterparty(uuid, text) TO authenticated;