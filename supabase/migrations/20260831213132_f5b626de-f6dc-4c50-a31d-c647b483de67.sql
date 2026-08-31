CREATE POLICY "support_attachments_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (
      public.is_admin(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "support_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "support_attachments_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'support-attachments' AND public.is_admin(auth.uid()));