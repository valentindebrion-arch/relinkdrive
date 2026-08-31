-- Top 10 : aucune lecture ni écriture directe pour les visiteurs non connectés.
-- L'affichage public passe exclusivement par les fonctions SECURITY DEFINER
-- (get_local_drivers / get_discover_drivers) qui exposent uniquement rank_position.
REVOKE ALL ON TABLE public.top10_drivers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.top10_drivers TO authenticated;
GRANT ALL ON TABLE public.top10_drivers TO service_role;

-- Profils chauffeurs : confirmation qu'aucun accès direct anonyme n'existe
-- (siret, vtc_card_number, billing_legal_info, admin_note, rejection_reason).
REVOKE ALL ON TABLE public.driver_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.driver_profiles TO authenticated;
GRANT ALL ON TABLE public.driver_profiles TO service_role;