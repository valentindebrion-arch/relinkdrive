
DROP POLICY IF EXISTS vehicles_read_connected_client ON storage.objects;

CREATE POLICY vehicles_read_connected_client ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'vehicles'
  AND EXISTS (
    SELECT 1
    FROM public.driver_profiles d
    WHERE d.user_id::text = (storage.foldername(objects.name))[1]
      AND public.is_connected(auth.uid(), d.user_id)
  )
);
