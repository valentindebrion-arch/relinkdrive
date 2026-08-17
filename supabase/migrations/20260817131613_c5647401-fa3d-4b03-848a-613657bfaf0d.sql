CREATE POLICY "vehicles_read_connected_client"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'vehicles'
  AND public.is_connected(auth.uid(), ((storage.foldername(name))[1])::uuid)
);