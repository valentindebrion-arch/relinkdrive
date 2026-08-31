-- driver_notes: aucun accès anonyme (aucune policy anon n'existe)
REVOKE ALL ON public.driver_notes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_notes TO authenticated;
GRANT ALL ON public.driver_notes TO service_role;

-- driver_profiles: confirmer l'absence d'accès direct anonyme
REVOKE ALL ON public.driver_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.driver_profiles TO authenticated;
GRANT ALL ON public.driver_profiles TO service_role;