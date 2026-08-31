ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS visitor_key text;

CREATE INDEX IF NOT EXISTS analytics_events_driver_event_time_idx
  ON public.analytics_events (driver_id, event, created_at DESC);

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
BEGIN
  IF _event NOT IN ('driver_page_view','qr_scan','contact_click') THEN
    RETURN;
  END IF;

  SELECT d.user_id, d.city INTO _driver, _city
  FROM public.driver_profiles d
  WHERE d.slug = _slug AND d.page_published;

  IF _driver IS NULL THEN RETURN; END IF;

  -- Le chauffeur ne gonfle jamais ses propres statistiques.
  IF auth.uid() IS NOT NULL AND auth.uid() = _driver THEN RETURN; END IF;

  _src := lower(coalesce(nullif(trim(_source), ''), 'direct'));
  IF _src NOT IN ('qr','discovery','direct','share','network') THEN
    _src := 'direct';
  END IF;

  _vk := left(coalesce(nullif(trim(_visitor_key), ''), coalesce(auth.uid()::text, 'anon')), 64);

  _window := CASE WHEN _event = 'contact_click' THEN interval '10 minutes' ELSE interval '30 minutes' END;

  IF EXISTS (
    SELECT 1 FROM public.analytics_events a
    WHERE a.driver_id = _driver
      AND a.event = _event
      AND coalesce(a.visitor_key, '') = _vk
      AND a.created_at >= now() - _window
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.analytics_events (event, driver_id, city, source, visitor_key)
  VALUES (_event, _driver, _city, _src, _vk);
END;
$function$;

REVOKE ALL ON FUNCTION public.track_driver_visit(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_driver_visit(text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_driver_qr_stats(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := auth.uid();
  _d int;
  _since timestamptz;
  _prev timestamptz;
  _all boolean;
  _res jsonb;
BEGIN
  IF _me IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  _all := coalesce(_days, 30) <= 0;
  _d := GREATEST(1, LEAST(coalesce(_days, 30), 3650));
  _since := CASE WHEN _all THEN '-infinity'::timestamptz ELSE now() - (_d || ' days')::interval END;
  _prev := CASE WHEN _all THEN '-infinity'::timestamptz ELSE now() - ((_d * 2) || ' days')::interval END;

  SELECT jsonb_build_object(
    'views', (SELECT count(*) FROM public.analytics_events a
        WHERE a.driver_id = _me AND a.event = 'driver_page_view' AND a.created_at >= _since),
    'unique_visitors', (SELECT count(DISTINCT coalesce(a.visitor_key, a.id::text)) FROM public.analytics_events a
        WHERE a.driver_id = _me AND a.event = 'driver_page_view' AND a.created_at >= _since),
    'qr_scans', (SELECT count(*) FROM public.analytics_events a
        WHERE a.driver_id = _me AND a.event = 'qr_scan' AND a.created_at >= _since),
    'contact_clicks', (SELECT count(*) FROM public.analytics_events a
        WHERE a.driver_id = _me AND a.event = 'contact_click' AND a.created_at >= _since),
    'adds', (SELECT count(*) FROM public.analytics_events a
        WHERE a.driver_id = _me AND a.event = 'driver_added' AND a.created_at >= _since),
    'adds_previous', CASE WHEN _all THEN NULL ELSE (SELECT count(*) FROM public.analytics_events a
        WHERE a.driver_id = _me AND a.event = 'driver_added'
          AND a.created_at >= _prev AND a.created_at < _since) END,
    'network_total', (SELECT count(*) FROM public.driver_client_connections c WHERE c.driver_id = _me),
    'sources', coalesce((
      SELECT jsonb_object_agg(s.src, s.n) FROM (
        SELECT coalesce(a.source, 'direct') AS src, count(*) AS n
        FROM public.analytics_events a
        WHERE a.driver_id = _me AND a.event = 'driver_page_view' AND a.created_at >= _since
        GROUP BY 1
      ) s), '{}'::jsonb),
    'series', coalesce((
      SELECT jsonb_agg(jsonb_build_object('day', to_char(g.day, 'YYYY-MM-DD'), 'views', coalesce(v.n, 0)) ORDER BY g.day)
      FROM generate_series(
             date_trunc('day', CASE WHEN _all THEN now() - interval '89 days' ELSE now() - ((_d - 1) || ' days')::interval END),
             date_trunc('day', now()),
             interval '1 day') AS g(day)
      LEFT JOIN (
        SELECT date_trunc('day', a.created_at) AS day, count(*) AS n
        FROM public.analytics_events a
        WHERE a.driver_id = _me AND a.event = 'driver_page_view' AND a.created_at >= _since
        GROUP BY 1
      ) v ON v.day = g.day
    ), '[]'::jsonb)
  ) INTO _res;

  RETURN _res;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_driver_qr_stats(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_driver_qr_stats(integer) TO authenticated;