
DROP POLICY IF EXISTS profiles_visible_to_connected_client ON public.profiles;
DROP POLICY IF EXISTS profiles_visible_to_connected_driver ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_connected_profiles(_ids uuid[])
RETURNS TABLE (id uuid, full_name text, avatar_url text, phone text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         p.full_name,
         p.avatar_url,
         CASE WHEN c.driver_id = auth.uid() THEN p.phone ELSE NULL END,
         CASE WHEN c.driver_id = auth.uid() THEN p.email ELSE NULL END
  FROM public.profiles p
  JOIN public.driver_client_connections c
    ON (c.client_id = p.id AND c.driver_id = auth.uid())
    OR (c.driver_id = p.id AND c.client_id = auth.uid())
  WHERE auth.uid() IS NOT NULL
    AND (_ids IS NULL OR p.id = ANY(_ids));
$$;

REVOKE ALL ON FUNCTION public.get_connected_profiles(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_connected_profiles(uuid[]) TO authenticated;

DROP POLICY IF EXISTS top10_select_authenticated ON public.top10_drivers;
CREATE POLICY top10_select_admin ON public.top10_drivers
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
