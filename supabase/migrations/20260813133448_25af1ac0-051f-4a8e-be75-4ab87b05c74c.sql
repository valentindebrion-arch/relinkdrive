
-- 1. Validation par section
CREATE TABLE IF NOT EXISTS public.dossier_section_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section text NOT NULL,
  status text NOT NULL DEFAULT 'approved',
  note text,
  admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, section)
);
GRANT SELECT ON public.dossier_section_reviews TO authenticated;
GRANT ALL ON public.dossier_section_reviews TO service_role;
ALTER TABLE public.dossier_section_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read section reviews" ON public.dossier_section_reviews
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Driver reads own section reviews" ON public.dossier_section_reviews
  FOR SELECT TO authenticated USING (driver_id = auth.uid());

-- 2. Notes internes (jamais visibles par le chauffeur)
CREATE TABLE IF NOT EXISTS public.dossier_admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.dossier_admin_notes TO authenticated;
GRANT ALL ON public.dossier_admin_notes TO service_role;
ALTER TABLE public.dossier_admin_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read internal notes" ON public.dossier_admin_notes
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins write internal notes" ON public.dossier_admin_notes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) AND admin_id = auth.uid());

-- 3. Journal des réauthentifications renforcées (export sensible)
CREATE TABLE IF NOT EXISTS public.admin_reauth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL DEFAULT 'password'
);
GRANT SELECT ON public.admin_reauth_events TO authenticated;
GRANT ALL ON public.admin_reauth_events TO service_role;
ALTER TABLE public.admin_reauth_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read own reauth events" ON public.admin_reauth_events
  FOR SELECT TO authenticated USING (admin_id = auth.uid() AND public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS admin_reauth_events_admin_idx
  ON public.admin_reauth_events (admin_id, verified_at DESC);

-- 4. Validation d'une section, revérifiée côté serveur
CREATE OR REPLACE FUNCTION public.admin_validate_section(_driver uuid, _section text, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _state jsonb; _sec jsonb;
BEGIN
  IF NOT public.is_admin(_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  _state := public.driver_dossier_state(_driver);
  SELECT s INTO _sec FROM jsonb_array_elements(_state->'sections') s WHERE s->>'key' = _section;
  IF _sec IS NULL THEN RAISE EXCEPTION 'section inconnue'; END IF;
  IF (_sec->>'state') <> 'approved' THEN
    RAISE EXCEPTION 'chaque pièce obligatoire de la section doit être validée et valide';
  END IF;

  INSERT INTO public.dossier_section_reviews (driver_id, section, status, note, admin_id)
  VALUES (_driver, _section, 'approved', _note, _uid)
  ON CONFLICT (driver_id, section)
  DO UPDATE SET status = 'approved', note = EXCLUDED.note, admin_id = _uid, updated_at = now();

  INSERT INTO public.audit_logs (actor_id, action, resource, resource_id, reason, new_value)
  VALUES (_uid, 'dossier_section_approved', 'driver_profiles', _driver, NULL,
          jsonb_build_object('section', _section));

  RETURN jsonb_build_object('section', _section, 'status', 'approved');
END; $function$;

REVOKE ALL ON FUNCTION public.admin_validate_section(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_validate_section(uuid, text, text) TO authenticated;
