DROP POLICY IF EXISTS events_insert_all ON public.analytics_events;

CREATE POLICY events_insert_self ON public.analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND event IN ('driver_added', 'ride_requested', 'ride_completed')
  );

REVOKE INSERT ON public.analytics_events FROM anon;

CREATE OR REPLACE FUNCTION public.track_driver_page_view(_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _driver uuid; _city text;
BEGIN
  SELECT d.user_id, d.city INTO _driver, _city
  FROM public.driver_profiles d
  WHERE d.slug = _slug AND d.verification_status = 'verified' AND d.page_published;
  IF _driver IS NULL THEN RETURN; END IF;
  INSERT INTO public.analytics_events (event, driver_id, city)
  VALUES ('driver_page_view', _driver, _city);
END; $$;

REVOKE ALL ON FUNCTION public.track_driver_page_view(text) FROM public;
GRANT EXECUTE ON FUNCTION public.track_driver_page_view(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_driver_page(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_driver_page(text) TO anon, authenticated;