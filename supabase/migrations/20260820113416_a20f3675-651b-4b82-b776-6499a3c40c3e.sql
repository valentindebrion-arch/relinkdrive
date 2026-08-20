CREATE OR REPLACE FUNCTION public.can_read_driver_media(_folder text, _viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.driver_profiles d
    WHERE d.user_id::text = _folder
      AND (
        d.user_id = _viewer
        OR (d.verification_status = 'verified' AND d.page_published)
        OR public.is_connected(_viewer, d.user_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_read_driver_media(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_read_driver_media(text, uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "vehicles_public_read_published_drivers" ON storage.objects;
DROP POLICY IF EXISTS "vehicles_read_connected_client" ON storage.objects;

CREATE POLICY "vehicles_read_public_or_connected" ON storage.objects
FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'vehicles'
  AND public.can_read_driver_media((storage.foldername(name))[1], auth.uid())
);