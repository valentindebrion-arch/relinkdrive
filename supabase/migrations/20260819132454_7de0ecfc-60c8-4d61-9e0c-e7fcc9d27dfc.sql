DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='invoices_driver_read') THEN
    CREATE POLICY "invoices_driver_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='invoices_admin_read') THEN
    CREATE POLICY "invoices_admin_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'invoices' AND public.is_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='invoices_driver_insert') THEN
    CREATE POLICY "invoices_driver_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;