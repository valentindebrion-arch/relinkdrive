INSERT INTO public.user_roles (user_id, role)
VALUES ('0384d329-86db-4228-bca5-921dc0db3f70', 'superadmin')
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles
WHERE user_id = '0384d329-86db-4228-bca5-921dc0db3f70' AND role <> 'superadmin';

CREATE POLICY "roles_admin_insert" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "roles_admin_update" ON public.user_roles
FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "roles_admin_delete" ON public.user_roles
FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));