DO $$
DECLARE _admin uuid := '0384d329-86db-4228-bca5-921dc0db3f70';
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin, 'role', 'authenticated')::text, true);

  UPDATE public.driver_profiles dp
  SET city = v.city,
      verification_status = 'verified',
      submitted_at = COALESCE(dp.submitted_at, now()),
      approved_at = now(),
      approved_by = _admin,
      admin_note = 'COMPTE DE TEST ReLink (développement)',
      page_published = true,
      accepting_requests = true
  FROM (VALUES
    ('relink1@relink.app','Clermont-Ferrand'),
    ('relink2@relink.app','Lyon'),
    ('relink3@relink.app','Vichy')
  ) AS v(email, city)
  JOIN public.profiles p ON p.email = v.email
  WHERE dp.user_id = p.id;

  INSERT INTO public.vehicles (driver_id, brand, model, year, color, max_passengers, is_primary)
  SELECT p.id, v.brand, v.model, v.year, v.color, 4, true
  FROM (VALUES
    ('relink1@relink.app','Tesla','Model Y',2026,'Gris'),
    ('relink2@relink.app','Porsche','Cayenne',2026,'Bleu nuit'),
    ('relink3@relink.app','Mercedes-Benz','EQE SUV',NULL::int,'Noir')
  ) AS v(email, brand, model, year, color)
  JOIN public.profiles p ON p.email = v.email
  WHERE NOT EXISTS (SELECT 1 FROM public.vehicles ve WHERE ve.driver_id = p.id);
END $$;