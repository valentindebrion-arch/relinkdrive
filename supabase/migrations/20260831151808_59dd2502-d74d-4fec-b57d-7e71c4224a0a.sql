DROP POLICY IF EXISTS driver_update_own ON public.driver_profiles;
CREATE POLICY driver_update_own ON public.driver_profiles
  FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) OR is_admin(auth.uid()))
  WITH CHECK ((user_id = auth.uid()) OR is_admin(auth.uid()));

REVOKE ALL ON TABLE public.driver_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.driver_profiles TO authenticated;
GRANT ALL ON public.driver_profiles TO service_role;