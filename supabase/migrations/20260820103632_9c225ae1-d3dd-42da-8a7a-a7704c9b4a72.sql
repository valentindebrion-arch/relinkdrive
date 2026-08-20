DROP POLICY IF EXISTS "branding_admin_read" ON storage.objects;
CREATE POLICY "branding_admin_read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'branding' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "branding_owner_read" ON storage.objects;
CREATE POLICY "branding_owner_read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = (auth.uid())::text);