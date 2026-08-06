CREATE POLICY "profiles_public_verified_drivers" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.driver_profiles d WHERE d.user_id = profiles.id AND d.verification_status = 'verified')
);
CREATE POLICY "profiles_visible_to_connected_driver" ON public.profiles FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.driver_client_connections c WHERE c.client_id = profiles.id AND c.driver_id = auth.uid())
);
GRANT SELECT ON public.profiles TO anon;