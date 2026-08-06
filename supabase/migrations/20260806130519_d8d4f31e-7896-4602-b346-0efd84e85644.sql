DROP POLICY IF EXISTS "Anyone can read vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "vehicles_public_read" ON storage.objects;

CREATE POLICY "vehicles_public_read_published_drivers"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'vehicles'
  AND EXISTS (
    SELECT 1 FROM public.driver_profiles d
    WHERE d.user_id::text = (storage.foldername(name))[1]
      AND d.verification_status = 'verified'
      AND d.page_published
  )
);

CREATE POLICY "vehicles_admin_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'vehicles' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
CREATE POLICY "notif_insert"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));