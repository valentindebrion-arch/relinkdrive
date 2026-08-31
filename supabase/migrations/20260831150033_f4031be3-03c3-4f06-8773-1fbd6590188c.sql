
create policy "avatars_owner_manage" on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (auth.uid())::text);

create policy "avatars_read_public_or_connected" on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars' and public.can_read_driver_media((storage.foldername(name))[1], auth.uid()));
