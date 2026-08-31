-- 1) Le thème est la source unique de vérité du mode Woman for Woman
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

    NEW.verification_status := OLD.verification_status;
    NEW.submitted_at := OLD.submitted_at;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;

  -- Le style Woman for Woman est réservé aux profils explicitement féminins
  IF NEW.booking_theme = 'women_for_women' AND coalesce(NEW.gender, '') <> 'female' THEN
    NEW.booking_theme := 'relink_classic';
  END IF;

  -- Une seule logique : thème = mode
  NEW.woman_for_woman := (NEW.booking_theme = 'women_for_women');

  IF NEW.booking_theme IS DISTINCT FROM OLD.booking_theme THEN
    NEW.theme_updated_at := now();
  END IF;

  RETURN NEW;
END; $function$;

-- 2) Alignement des données existantes
UPDATE public.driver_profiles
   SET booking_theme = 'women_for_women'
 WHERE woman_for_woman AND gender = 'female' AND booking_theme <> 'women_for_women';

UPDATE public.driver_profiles
   SET woman_for_woman = (booking_theme = 'women_for_women')
 WHERE woman_for_woman <> (booking_theme = 'women_for_women');

-- 3) Thème public : éligibilité basée sur le genre déclaré
CREATE OR REPLACE FUNCTION public.get_driver_booking_theme(_driver uuid DEFAULT NULL::uuid, _slug text DEFAULT NULL::text)
RETURNS TABLE(user_id uuid, slug text, booking_theme text, brand_display_name text, brand_logo_path text, brand_cover_path text, brand_welcome_message text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.user_id,
         p.slug,
         CASE
           WHEN p.booking_theme = 'women_for_women' AND coalesce(p.gender, '') <> 'female'
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
$function$;

-- 4) Découverte : les profils Woman for Woman ne sortent que pour les clientes
CREATE OR REPLACE FUNCTION public.get_discover_drivers(_limit integer DEFAULT 20)
 RETURNS TABLE(user_id uuid, slug text, display_name text, full_name text, avatar_url text, city text, zone text, public_intro text, bio text, services text[], languages text[], long_distance boolean, airports text[], on_duty boolean, accepting_requests boolean, member_since timestamp with time zone, vehicle_brand text, vehicle_model text, vehicle_category text, vehicle_photo_url text, vehicle_interior_photo_url text, max_passengers integer, rating_avg numeric, rating_count bigint, woman_for_woman boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.user_id, d.slug,
         COALESCE(NULLIF(d.business_name, ''), p.full_name, 'Chauffeur'),
         p.full_name, p.avatar_url,
         d.city, d.zone, d.public_intro, d.bio,
         d.services, d.languages, d.long_distance, d.airports,
         d.on_duty, d.accepting_requests, d.created_at,
         v.brand, v.model, v.category, v.photo_url, v.photo_interior_url, v.max_passengers,
         NULL::numeric, 0::bigint,
         d.woman_for_woman
  FROM public.driver_profiles d
  JOIN public.profiles p ON p.id = d.user_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.vehicles vv
    WHERE vv.driver_id = d.user_id
    ORDER BY vv.is_primary DESC, vv.created_at
    LIMIT 1
  ) v ON true
  WHERE d.verification_status = 'verified'
    AND d.page_published
    AND auth.uid() IS NOT NULL
    AND d.user_id <> auth.uid()
    AND (NOT d.woman_for_woman OR public.wfw_relation_allowed(auth.uid(), d.user_id))
    AND NOT EXISTS (
      SELECT 1 FROM public.driver_client_connections c
      WHERE c.client_id = auth.uid() AND c.driver_id = d.user_id
    )
  ORDER BY d.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 50));
$function$;

CREATE OR REPLACE FUNCTION public.get_local_drivers(_sector text DEFAULT NULL::text, _limit integer DEFAULT 60)
 RETURNS TABLE(user_id uuid, slug text, display_name text, avatar_url text, city text, zone text, service_areas text[], service_departments text[], public_intro text, bio text, services text[], long_distance boolean, airports text[], on_duty boolean, accepting_requests boolean, member_since timestamp with time zone, vehicle_brand text, vehicle_model text, vehicle_category text, vehicle_photo_url text, vehicle_interior_photo_url text, max_passengers integer, price_per_km numeric, rating_avg numeric, rating_count bigint, woman_for_woman boolean, rank_position integer, sector_match boolean, quality_score numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH s AS (SELECT NULLIF(public.relink_normalize(_sector), '') AS q)
  SELECT d.user_id, d.slug,
         COALESCE(NULLIF(d.business_name, ''), p.full_name, 'Chauffeur'),
         p.avatar_url, d.city, d.zone, d.service_areas, d.service_departments,
         d.public_intro, d.bio,
         d.services, d.long_distance, d.airports, d.on_duty, d.accepting_requests, d.created_at,
         v.brand, v.model, v.category, v.photo_url, v.photo_interior_url, v.max_passengers,
         tar.price_per_km,
         NULL::numeric, 0::bigint,
         d.woman_for_woman,
         t.rank_position,
         m.matched,
         (CASE WHEN t.rank_position IS NOT NULL THEN 3 ELSE 0 END)
           + (CASE WHEN COALESCE(d.public_intro, '') <> '' THEN 0.5 ELSE 0 END)
           + (CASE WHEN COALESCE(d.bio, '') <> '' THEN 0.5 ELSE 0 END)
           + (CASE WHEN v.photo_url IS NOT NULL THEN 1 ELSE 0 END)
           + (CASE WHEN COALESCE(array_length(d.services, 1), 0) > 0 THEN 0.5 ELSE 0 END)
           + (CASE WHEN tar.price_per_km IS NOT NULL THEN 0.5 ELSE 0 END)
           + (CASE WHEN d.on_duty THEN 0.5 ELSE 0 END) AS quality_score
  FROM public.driver_profiles d
  JOIN public.profiles p ON p.id = d.user_id
  CROSS JOIN s
  LEFT JOIN public.top10_drivers t ON t.driver_id = d.user_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.vehicles vv
    WHERE vv.driver_id = d.user_id
    ORDER BY vv.is_primary DESC, vv.created_at
    LIMIT 1
  ) v ON true
  LEFT JOIN LATERAL (
    SELECT dt.price_per_km_ht AS price_per_km FROM public.driver_tariffs dt
    WHERE dt.driver_id = d.user_id
    ORDER BY dt.created_at DESC
    LIMIT 1
  ) tar ON true
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN s.q IS NULL THEN false
      ELSE EXISTS (
        SELECT 1
        FROM unnest(
          ARRAY[d.city, d.zone] || COALESCE(d.service_areas, ARRAY[]::text[])
        ) AS area(txt)
        WHERE NULLIF(public.relink_normalize(area.txt), '') IS NOT NULL
          AND (public.relink_normalize(area.txt) LIKE '%' || s.q || '%'
               OR s.q LIKE '%' || public.relink_normalize(area.txt) || '%')
      )
    END AS matched
  ) m
  WHERE auth.uid() IS NOT NULL
    AND d.verification_status = 'verified'
    AND d.page_published
    AND d.user_id <> auth.uid()
    AND (NOT d.woman_for_woman OR public.wfw_relation_allowed(auth.uid(), d.user_id))
    AND NOT EXISTS (
      SELECT 1 FROM public.driver_client_connections c
      WHERE c.client_id = auth.uid() AND c.driver_id = d.user_id
    )
    AND (s.q IS NULL OR m.matched)
  ORDER BY quality_score DESC, d.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 60), 100));
$function$;

CREATE OR REPLACE FUNCTION public.search_public_drivers(_q text DEFAULT NULL::text, _department text DEFAULT NULL::text, _service text DEFAULT NULL::text, _category text DEFAULT NULL::text, _min_passengers integer DEFAULT NULL::integer, _language text DEFAULT NULL::text, _limit integer DEFAULT 40, _offset integer DEFAULT 0)
 RETURNS TABLE(user_id uuid, slug text, display_name text, full_name text, avatar_url text, city text, zone text, public_intro text, services text[], languages text[], service_areas text[], service_departments text[], experience_years integer, vehicle_brand text, vehicle_model text, vehicle_category text, vehicle_photo_url text, max_passengers integer, luggage_capacity integer, woman_for_woman boolean, member_since timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.user_id, d.slug,
         COALESCE(NULLIF(d.business_name, ''), p.full_name, 'Chauffeur'),
         p.full_name, p.avatar_url,
         d.city, d.zone, d.public_intro,
         d.services, d.languages, d.service_areas, d.service_departments,
         d.experience_years,
         v.brand, v.model, v.category, v.photo_url, v.max_passengers, v.luggage_capacity,
         d.woman_for_woman, d.created_at
  FROM public.driver_profiles d
  JOIN public.profiles p ON p.id = d.user_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.vehicles vv
    WHERE vv.driver_id = d.user_id
    ORDER BY vv.is_primary DESC, vv.created_at
    LIMIT 1
  ) v ON true
  WHERE d.verification_status = 'verified'
    AND d.page_published
    AND (NOT d.woman_for_woman OR public.wfw_relation_allowed(auth.uid(), d.user_id))
    AND (
      _q IS NULL OR btrim(_q) = '' OR
      (
        COALESCE(d.city,'') || ' ' || COALESCE(d.zone,'') || ' ' ||
        COALESCE(d.business_name,'') || ' ' || COALESCE(p.full_name,'') || ' ' ||
        COALESCE(array_to_string(d.service_areas, ' '), '')
      ) ILIKE '%' || btrim(_q) || '%'
    )
    AND (_department IS NULL OR _department = ANY (COALESCE(d.service_departments, ARRAY[]::text[])))
    AND (_service IS NULL OR _service = ANY (COALESCE(d.services, ARRAY[]::text[])))
    AND (_language IS NULL OR _language = ANY (COALESCE(d.languages, ARRAY[]::text[])))
    AND (_category IS NULL OR v.category = _category)
    AND (_min_passengers IS NULL OR COALESCE(v.max_passengers, 0) >= _min_passengers)
  ORDER BY d.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 40), 60))
  OFFSET GREATEST(0, COALESCE(_offset, 0));
$function$;

-- 5) Vitrine publique : accès direct protégé
CREATE OR REPLACE FUNCTION public.driver_page_access(_slug text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN d.user_id IS NULL THEN 'missing'
    WHEN NOT d.woman_for_woman THEN 'ok'
    WHEN auth.uid() IS NULL THEN 'wfw_signin'
    WHEN auth.uid() = d.user_id OR public.is_admin(auth.uid()) THEN 'ok'
    WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.gender = 'female') THEN 'ok'
    ELSE 'wfw_locked'
  END
  FROM (
    SELECT dp.user_id, dp.woman_for_woman
    FROM public.driver_profiles dp
    WHERE dp.slug = _slug AND dp.verification_status = 'verified' AND dp.page_published
    LIMIT 1
  ) d
  RIGHT JOIN (SELECT 1) x ON true
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.get_public_driver_page(_slug text)
 RETURNS TABLE(user_id uuid, slug text, business_name text, bio text, public_intro text, city text, zone text, service_areas text[], stations text[], airports text[], long_distance boolean, availability text[], booking_notice text, accepting_requests boolean, member_since timestamp with time zone, languages text[], services text[], full_name text, avatar_url text, vehicle_brand text, vehicle_model text, vehicle_color text, vehicle_year integer, vehicle_category text, vehicle_photo_url text, vehicle_interior_photo_url text, vehicle_front_photo_url text, vehicle_side_photo_url text, max_passengers integer, luggage_capacity integer, large_luggage_capacity integer, cabin_luggage_capacity integer, pets_policy text, pets_max integer, pets_carrier_required boolean, pets_conditions text, child_seat boolean, booster_seat boolean, stroller_space boolean, accessible boolean, large_trunk boolean, air_conditioning boolean, chargers boolean, water boolean, card_payment boolean, quiet_ride boolean, luggage_help boolean, pets_allowed boolean, company_verified boolean, verified_docs text[], public_phone text, whatsapp_number text, instagram_url text, facebook_url text, tiktok_url text, linkedin_url text, woman_for_woman boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.user_id, d.slug, d.business_name, d.bio, d.public_intro,
         d.city, d.zone, d.service_areas, d.stations, d.airports,
         d.long_distance, d.availability, d.booking_notice,
         d.accepting_requests, d.created_at,
         d.languages, d.services, p.full_name, p.avatar_url,
         v.brand, v.model, v.color, v.year, v.category, v.photo_url, v.photo_interior_url,
         v.photo_front_url, v.photo_side_url,
         v.max_passengers, v.luggage_capacity,
         v.large_luggage_capacity, v.cabin_luggage_capacity,
         v.pets_policy, v.pets_max, v.pets_carrier_required, v.pets_conditions,
         v.child_seat, v.booster_seat, v.stroller_space, v.accessible, v.large_trunk,
         v.air_conditioning, v.chargers, v.water, v.card_payment,
         v.quiet_ride, v.luggage_help, v.pets_allowed,
         EXISTS (SELECT 1 FROM public.companies c WHERE c.driver_id = d.user_id AND c.siret IS NOT NULL),
         COALESCE((
           SELECT array_agg(DISTINCT vd.doc_type)
           FROM public.verification_documents vd
           WHERE vd.driver_id = d.user_id AND vd.status = 'approved'
         ), '{}'),
         CASE WHEN d.show_public_phone THEN d.public_phone END,
         CASE WHEN d.show_whatsapp THEN d.whatsapp_number END,
         d.instagram_url, d.facebook_url, d.tiktok_url, d.linkedin_url,
         d.woman_for_woman
  FROM public.driver_profiles d
  JOIN public.profiles p ON p.id = d.user_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.vehicles vv
    WHERE vv.driver_id = d.user_id
    ORDER BY vv.is_primary DESC, vv.created_at
    LIMIT 1
  ) v ON true
  WHERE d.slug = _slug
    AND d.verification_status = 'verified'
    AND d.page_published
    AND (
      NOT d.woman_for_woman
      OR auth.uid() = d.user_id
      OR public.is_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles pc WHERE pc.id = auth.uid() AND pc.gender = 'female')
    );
$function$;

CREATE OR REPLACE FUNCTION public.get_public_driver_pricing(_slug text)
 RETURNS TABLE(driver_id uuid, price_per_km numeric, minimum numeric, pickup_pct numeric, basis text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.user_id, t.price_per_km_ht, t.minimum_ht, t.pickup_pct, t.basis
  FROM public.driver_profiles d
  JOIN public.driver_tariffs t ON t.driver_id = d.user_id
  WHERE d.slug = _slug
    AND d.verification_status = 'verified'
    AND d.page_published
    AND (
      NOT d.woman_for_woman
      OR auth.uid() = d.user_id
      OR public.is_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles pc WHERE pc.id = auth.uid() AND pc.gender = 'female')
    )
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.driver_page_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_page_access(text) TO anon, authenticated, service_role;