-- Storage policies for driver documents (private) and vehicle photos (signed reads)

-- documents: only owner (path prefix = user id) and admins
CREATE POLICY "Drivers manage own documents"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins read documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND public.is_admin(auth.uid()));

-- vehicles: owner writes, everyone may read (signed urls for public driver page)
CREATE POLICY "Drivers manage own vehicle photos"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'vehicles' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'vehicles' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can read vehicle photos"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'vehicles');
