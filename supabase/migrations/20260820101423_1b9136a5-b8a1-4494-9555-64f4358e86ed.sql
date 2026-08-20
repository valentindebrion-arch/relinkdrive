
DROP POLICY IF EXISTS branding_public_read ON storage.objects;

CREATE POLICY branding_public_read ON storage.objects
FOR SELECT
USING (
  bucket_id = 'branding'
  AND EXISTS (
    SELECT 1 FROM public.driver_profiles d
    WHERE d.user_id::text = (storage.foldername(objects.name))[1]
      AND d.verification_status = 'verified'::verification_status
      AND d.page_published
  )
);

CREATE POLICY branding_owner_read ON storage.objects
FOR SELECT
USING (
  bucket_id = 'branding'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY branding_admin_read ON storage.objects
FOR SELECT
USING (bucket_id = 'branding' AND public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_connection_insert_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) AND auth.uid() <> NEW.driver_id THEN
    NEW.crm_status := 'new'::crm_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_connection_insert_defaults ON public.driver_client_connections;
CREATE TRIGGER trg_connection_insert_defaults
BEFORE INSERT ON public.driver_client_connections
FOR EACH ROW EXECUTE FUNCTION public.guard_connection_insert_defaults();
