DROP POLICY IF EXISTS "events_insert_self" ON public.analytics_events;
CREATE POLICY "events_insert_self" ON public.analytics_events
FOR INSERT TO authenticated
WITH CHECK (
  client_id = auth.uid()
  AND event = ANY (ARRAY['driver_added','ride_requested','ride_completed'])
  AND driver_id IS NOT NULL
  AND public.is_connected(auth.uid(), driver_id)
);

DROP POLICY IF EXISTS "history_insert" ON public.ride_status_history;
CREATE POLICY "history_insert" ON public.ride_status_history
FOR INSERT TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = ride_status_history.ride_id
        AND (r.driver_id = auth.uid() OR r.client_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.ride_requests q
      WHERE q.id = ride_status_history.request_id
        AND (q.driver_id = auth.uid() OR q.client_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "rides_insert_driver" ON public.rides;
CREATE POLICY "rides_insert_driver" ON public.rides
FOR INSERT TO authenticated
WITH CHECK (
  driver_id = auth.uid()
  AND (client_id IS NULL OR public.is_connected(client_id, auth.uid()))
  AND (
    request_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.ride_requests q
      WHERE q.id = rides.request_id
        AND q.driver_id = auth.uid()
        AND (rides.client_id IS NULL OR q.client_id = rides.client_id)
    )
  )
);