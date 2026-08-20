CREATE POLICY "vehicles_admin_write_objects" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vehicles' AND public.is_admin(auth.uid()));

CREATE POLICY "vehicles_admin_update_objects" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'vehicles' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'vehicles' AND public.is_admin(auth.uid()));

CREATE POLICY "vehicles_admin_delete_objects" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'vehicles' AND public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_log_vehicle_photo(
  _driver_id uuid,
  _field text,
  _action text,
  _old_path text,
  _new_path text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _field NOT IN ('photo_url', 'photo_interior_url') THEN
    RAISE EXCEPTION 'invalid field';
  END IF;
  IF _action NOT IN ('replace', 'delete') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, resource, resource_id, old_value, new_value)
  VALUES (
    auth.uid(),
    CASE WHEN _action = 'delete' THEN 'vehicle_photo_deleted' ELSE 'vehicle_photo_replaced' END,
    _field,
    _driver_id,
    jsonb_build_object('path', _old_path),
    jsonb_build_object('path', _new_path)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_log_vehicle_photo(uuid, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_vehicle_photo(uuid, text, text, text, text) TO authenticated;