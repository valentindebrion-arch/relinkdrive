DROP POLICY IF EXISTS "vehicles_read_connected_client" ON storage.objects;
CREATE POLICY "vehicles_read_connected_client"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'vehicles'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.is_connected(auth.uid(), ((storage.foldername(name))[1])::uuid)
);