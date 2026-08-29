DROP POLICY IF EXISTS notes_driver_only ON public.driver_notes;
CREATE POLICY notes_driver_connected ON public.driver_notes
  FOR ALL TO authenticated
  USING (driver_id = auth.uid() AND public.is_connected(client_id, driver_id))
  WITH CHECK (driver_id = auth.uid() AND public.is_connected(client_id, driver_id));

CREATE POLICY notif_delete_own ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());