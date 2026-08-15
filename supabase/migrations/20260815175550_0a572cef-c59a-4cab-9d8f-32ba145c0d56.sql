ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS booking_theme text NOT NULL DEFAULT 'relink_classic',
  ADD COLUMN IF NOT EXISTS brand_display_name text,
  ADD COLUMN IF NOT EXISTS brand_logo_path text,
  ADD COLUMN IF NOT EXISTS brand_cover_path text,
  ADD COLUMN IF NOT EXISTS brand_welcome_message text,
  ADD COLUMN IF NOT EXISTS theme_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS women_for_women_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS women_for_women_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS women_for_women_verified_by uuid;

ALTER TABLE public.driver_profiles DROP CONSTRAINT IF EXISTS driver_profiles_booking_theme_check;
ALTER TABLE public.driver_profiles ADD CONSTRAINT driver_profiles_booking_theme_check
  CHECK (booking_theme IN ('relink_classic','luxury_black_gold','dynamic_red','professional_blue','women_for_women'));

ALTER TABLE public.driver_profiles DROP CONSTRAINT IF EXISTS driver_profiles_brand_welcome_len;
ALTER TABLE public.driver_profiles ADD CONSTRAINT driver_profiles_brand_welcome_len
  CHECK (brand_welcome_message IS NULL OR char_length(brand_welcome_message) <= 120);

ALTER TABLE public.driver_profiles DROP CONSTRAINT IF EXISTS driver_profiles_brand_name_len;
ALTER TABLE public.driver_profiles ADD CONSTRAINT driver_profiles_brand_name_len
  CHECK (brand_display_name IS NULL OR char_length(brand_display_name) <= 60);

CREATE OR REPLACE FUNCTION public.guard_driver_profile_admin_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    NEW.admin_note := OLD.admin_note;
    NEW.approved_at := OLD.approved_at;
    NEW.approved_by := OLD.approved_by;
    NEW.suspended_at := OLD.suspended_at;
    NEW.suspension_reason := OLD.suspension_reason;

    NEW.women_for_women_eligible := OLD.women_for_women_eligible;
    NEW.women_for_women_verified_at := OLD.women_for_women_verified_at;
    NEW.women_for_women_verified_by := OLD.women_for_women_verified_by;

    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      IF coalesce(current_setting('relink.dossier_submit', true), '0') = '1'
         AND OLD.verification_status IN ('incomplete','changes_requested','expired_documents')
         AND NEW.verification_status = 'pending' THEN
        NEW.rejection_reason := NULL;
      ELSE
        NEW.verification_status := OLD.verification_status;
        NEW.submitted_at := OLD.submitted_at;
      END IF;
    END IF;
    IF NEW.verification_status <> 'pending' THEN
      NEW.rejection_reason := OLD.rejection_reason;
    END IF;

    IF NEW.verification_status <> 'verified' THEN
      NEW.page_published := false;
      NEW.on_duty := false;
      NEW.accepting_requests := false;
    END IF;
  END IF;

  IF NEW.booking_theme = 'women_for_women' AND coalesce(NEW.women_for_women_eligible, false) = false THEN
    NEW.booking_theme := 'relink_classic';
  END IF;

  IF NEW.booking_theme IS DISTINCT FROM OLD.booking_theme THEN
    NEW.theme_updated_at := now();
  END IF;

  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_driver_booking_theme(_driver uuid DEFAULT NULL, _slug text DEFAULT NULL)
RETURNS TABLE(
  user_id uuid,
  slug text,
  booking_theme text,
  brand_display_name text,
  brand_logo_path text,
  brand_cover_path text,
  brand_welcome_message text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.user_id,
         p.slug,
         CASE
           WHEN p.booking_theme = 'women_for_women' AND coalesce(p.women_for_women_eligible,false) = false
             THEN 'relink_classic'
           WHEN p.booking_theme IN ('relink_classic','luxury_black_gold','dynamic_red','professional_blue','women_for_women')
             THEN p.booking_theme
           ELSE 'relink_classic'
         END AS booking_theme,
         p.brand_display_name,
         p.brand_logo_path,
         p.brand_cover_path,
         p.brand_welcome_message
  FROM public.driver_profiles p
  WHERE (_driver IS NOT NULL AND p.user_id = _driver)
     OR (_slug IS NOT NULL AND p.slug = _slug)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_driver_booking_theme(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_driver_booking_theme(uuid, text) TO anon, authenticated;

DROP POLICY IF EXISTS "branding_public_read" ON storage.objects;
CREATE POLICY "branding_public_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "branding_owner_insert" ON storage.objects;
CREATE POLICY "branding_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "branding_owner_update" ON storage.objects;
CREATE POLICY "branding_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "branding_owner_delete" ON storage.objects;
CREATE POLICY "branding_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text);