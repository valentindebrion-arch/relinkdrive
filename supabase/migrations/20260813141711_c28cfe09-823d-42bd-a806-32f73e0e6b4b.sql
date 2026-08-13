DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='dossier_exports_admin_read') THEN
    CREATE POLICY "dossier_exports_admin_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'dossier-exports' AND public.is_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='dossier_exports_admin_insert') THEN
    CREATE POLICY "dossier_exports_admin_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'dossier-exports' AND public.is_admin(auth.uid()));
  END IF;
END $$;