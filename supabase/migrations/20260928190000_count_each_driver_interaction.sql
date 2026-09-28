-- Compte chaque interaction réelle. La courte fenêtre évite uniquement les
-- doubles envois techniques (double rendu, double-clic), sans masquer plusieurs
-- consultations légitimes effectuées depuis le même navigateur.
CREATE OR REPLACE FUNCTION public.track_driver_visit(
  _slug text,
  _event text,
  _source text DEFAULT NULL,
  _visitor_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _driver uuid;
  _city text;
  _src text;
  _vk text;
  _window interval;
  _bucket_seconds integer;
  _bucket text;
BEGIN
  IF _event NOT IN ('driver_page_view','qr_scan','contact_click') THEN
    RETURN;
  END IF;

  SELECT d.user_id, d.city INTO _driver, _city
  FROM public.driver_profiles d
  WHERE d.slug = _slug AND d.page_published;

  IF _driver IS NULL THEN RETURN; END IF;

  -- Une consultation du chauffeur sur sa propre vitrine reste exclue.
  IF auth.uid() IS NOT NULL AND auth.uid() = _driver THEN RETURN; END IF;

  _src := lower(coalesce(nullif(trim(_source), ''), 'direct'));
  IF _src NOT IN ('qr','discovery','direct','share','network') THEN
    _src := 'direct';
  END IF;

  _vk := left(coalesce(nullif(trim(_visitor_key), ''), coalesce(auth.uid()::text, 'anon')), 64);
  _bucket_seconds := CASE
    WHEN _event = 'contact_click' THEN 2
    WHEN _event = 'qr_scan' THEN 5
    ELSE 5
  END;
  _window := (_bucket_seconds || ' seconds')::interval;
  _bucket := floor(extract(epoch FROM now()) / _bucket_seconds)::bigint::text;

  IF EXISTS (
    SELECT 1 FROM public.analytics_events a
    WHERE a.driver_id = _driver
      AND a.event = _event
      AND coalesce(a.visitor_key, '') = _vk
      AND a.created_at >= now() - _window
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.analytics_events (
    event, driver_id, city, source, visitor_key, dedupe_bucket
  ) VALUES (
    _event, _driver, _city, _src, _vk, _bucket
  )
  ON CONFLICT DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION public.track_driver_visit(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_driver_visit(text, text, text, text) TO anon, authenticated;
