CREATE OR REPLACE FUNCTION public.is_public_driver_folder(_folder text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.driver_profiles d
    WHERE d.user_id::text = _folder
      AND d.verification_status = 'verified'
      AND d.page_published
  );
$$;

DROP POLICY IF EXISTS "branding_public_read" ON storage.objects;
CREATE POLICY "branding_public_read" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'branding' AND public.is_public_driver_folder((storage.foldername(name))[1]));