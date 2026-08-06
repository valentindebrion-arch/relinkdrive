
DROP POLICY IF EXISTS "vehicles_public_read" ON storage.objects;
CREATE POLICY "vehicles_public_read" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'vehicles');
