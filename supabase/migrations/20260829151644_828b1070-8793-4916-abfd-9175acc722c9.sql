-- 1. Archivage complet avant toute suppression -------------------------------
CREATE SCHEMA IF NOT EXISTS archive;
REVOKE ALL ON SCHEMA archive FROM anon, authenticated;

DO $$
DECLARE
  t text;
  legacy text[] := ARRAY[
    'rides','ride_requests','ride_status_history','ride_reviews',
    'ride_request_terms_acceptances','invoices','invoice_documents','invoice_events',
    'invoice_submissions','invoice_submission_events','invoice_transmissions','invoice_counters',
    'payments','supplier_invoices','ereporting_periods','ereporting_payment_entries',
    'ereporting_submissions','ereporting_transactions','e_invoicing_connections',
    'billing_customers','driver_tax_profiles','driver_working_hours','driver_absences',
    'driver_breaks','driver_day_overrides','driver_schedule_settings','live_locations',
    'document_reviews','driver_tariff_migrations'
  ];
BEGIN
  FOREACH t IN ARRAY legacy LOOP
    IF to_regclass('public.' || t) IS NOT NULL AND to_regclass('archive.' || t) IS NULL THEN
      EXECUTE format('CREATE TABLE archive.%I AS TABLE public.%I', t, t);
    END IF;
  END LOOP;
END $$;

-- 2. Découverte : plus aucune dépendance aux avis de course -------------------
CREATE OR REPLACE FUNCTION public.get_discover_drivers(_limit integer DEFAULT 20)
RETURNS TABLE(
  user_id uuid, slug text, display_name text, full_name text, avatar_url text,
  city text, zone text, public_intro text, bio text, services text[], languages text[],
  long_distance boolean, airports text[], on_duty boolean, accepting_requests boolean,
  member_since timestamptz, vehicle_brand text, vehicle_model text, vehicle_category text,
  vehicle_photo_url text, vehicle_interior_photo_url text, max_passengers integer,
  rating_avg numeric, rating_count bigint, woman_for_woman boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    AND NOT EXISTS (
      SELECT 1 FROM public.driver_client_connections c
      WHERE c.client_id = auth.uid() AND c.driver_id = d.user_id
    )
  ORDER BY d.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 50));
$$;

-- 3. Signalements : plus de rattachement à une course -------------------------
ALTER TABLE public.reports DROP COLUMN IF EXISTS ride_id;

-- 4. Suppression des fonctions de gestion de course et de facturation ---------
DO $$
DECLARE
  fn record;
  names text[] := ARRAY[
    'create_client_ride_request','cancel_client_ride_request','admin_cancel_ride',
    'compute_ride_quote','check_ride_compatibility','set_ride_type','set_ride_request_type',
    'sync_ride_tax_snapshot','on_ride_completed','expire_stale_immediate_requests',
    'get_blocking_immediate_request','driver_available_between','driver_day_window',
    'driver_supports_scheduled','driver_payment_methods','payment_method_label',
    'issue_invoice','next_invoice_number','create_credit_note','record_invoice_payment',
    'recompute_invoice_payment','record_invoice_documents','record_invoice_transmission',
    'start_invoice_submission','queue_ereporting','get_invoice_issuer',
    'get_public_driver_rating','get_public_driver_reviews','get_top10_drivers',
    'driver_tax_at','get_driver_vehicle_capacity','notify_ride_events','notify_request_events',
    'guard_ride_update','guard_ride_review','guard_ride_request_update',
    'guard_ride_request_availability','guard_ride_request_compatibility',
    'guard_ride_request_driver_verified','guard_ride_request_payment','guard_ride_invoice_draft',
    'guard_invoice_update','guard_invoice_delete','guard_invoice_document_immutable',
    'guard_woman_for_woman_ride','guard_woman_for_woman_request','guard_wfw_request_access',
    'guard_driver_on_duty','enforce_tariff_plan','guard_driver_plan'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (names)
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', fn.sig);
  END LOOP;
END $$;

-- 5. Suppression des tables devenues inutiles ---------------------------------
DROP TABLE IF EXISTS
  public.ereporting_payment_entries,
  public.ereporting_transactions,
  public.ereporting_submissions,
  public.ereporting_periods,
  public.invoice_submission_events,
  public.invoice_submissions,
  public.invoice_transmissions,
  public.invoice_documents,
  public.invoice_events,
  public.invoice_counters,
  public.payments,
  public.supplier_invoices,
  public.invoices,
  public.ride_request_terms_acceptances,
  public.ride_status_history,
  public.ride_reviews,
  public.rides,
  public.ride_requests,
  public.e_invoicing_connections,
  public.billing_customers,
  public.driver_tax_profiles,
  public.driver_working_hours,
  public.driver_absences,
  public.driver_breaks,
  public.driver_day_overrides,
  public.driver_schedule_settings,
  public.live_locations,
  public.document_reviews,
  public.driver_tariff_migrations
CASCADE;

-- 6. Notifications : le rattachement aux courses disparaît -------------------
ALTER TABLE public.notifications DROP COLUMN IF EXISTS ride_id;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS request_id;