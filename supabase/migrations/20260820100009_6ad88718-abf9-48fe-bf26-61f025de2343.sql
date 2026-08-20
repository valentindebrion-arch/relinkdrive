
ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_reason text,
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS pro_tariff_snapshot jsonb;

ALTER TABLE public.driver_profiles
  DROP CONSTRAINT IF EXISTS driver_profiles_billing_status_check;
ALTER TABLE public.driver_profiles
  ADD CONSTRAINT driver_profiles_billing_status_check
  CHECK (billing_status IN ('free','active','trial','complimentary','past_due','canceled'));

CREATE TABLE IF NOT EXISTS public.driver_plan_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_plan text NOT NULL,
  new_plan text NOT NULL,
  old_billing_status text,
  new_billing_status text,
  reason text,
  expires_at timestamptz,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.driver_plan_changes TO authenticated;
GRANT ALL ON public.driver_plan_changes TO service_role;
ALTER TABLE public.driver_plan_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_changes_select ON public.driver_plan_changes;
CREATE POLICY plan_changes_select ON public.driver_plan_changes
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR driver_id = auth.uid());

CREATE INDEX IF NOT EXISTS driver_plan_changes_driver_idx
  ON public.driver_plan_changes (driver_id, created_at DESC);

-- Application d'un changement d'abonnement (administration uniquement).
CREATE OR REPLACE FUNCTION public.admin_set_driver_plan(
  _driver uuid,
  _plan text,
  _billing_status text DEFAULT NULL,
  _reason text DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL,
  _restore_tariffs boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _old_plan text; _old_billing text; _snapshot jsonb;
  _billing text; _title text; _body text;
BEGIN
  IF NOT public.is_admin(_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _plan NOT IN ('free','pro') THEN RAISE EXCEPTION 'plan inconnu'; END IF;

  SELECT plan, billing_status, pro_tariff_snapshot
    INTO _old_plan, _old_billing, _snapshot
  FROM public.driver_profiles WHERE user_id = _driver FOR UPDATE;
  IF _old_plan IS NULL THEN RAISE EXCEPTION 'chauffeur introuvable'; END IF;

  _billing := COALESCE(_billing_status, CASE WHEN _plan = 'pro' THEN 'active' ELSE 'free' END);
  IF _billing NOT IN ('free','active','trial','complimentary','past_due','canceled') THEN
    RAISE EXCEPTION 'statut de facturation inconnu';
  END IF;

  IF _plan = 'free' THEN
    -- Mémorisation des réglages Pro puis retour au tarif ReLink imposé.
    SELECT to_jsonb(t) - 'driver_id' - 'created_at' - 'updated_at'
      INTO _snapshot
    FROM public.driver_tariffs t WHERE t.driver_id = _driver;

    UPDATE public.driver_profiles
       SET plan = 'free',
           billing_status = _billing,
           plan_reason = _reason,
           plan_expires_at = NULL,
           pro_tariff_snapshot = COALESCE(_snapshot, pro_tariff_snapshot)
     WHERE user_id = _driver;

    UPDATE public.driver_tariffs
       SET price_per_km_ht = 1.85, pickup_pct = 0, night_enabled = false, updated_at = now()
     WHERE driver_id = _driver;
  ELSE
    UPDATE public.driver_profiles
       SET plan = 'pro',
           billing_status = _billing,
           plan_reason = _reason,
           plan_started_at = COALESCE(plan_started_at, now()),
           plan_expires_at = _expires_at
     WHERE user_id = _driver;

    IF _restore_tariffs AND _snapshot IS NOT NULL THEN
      UPDATE public.driver_tariffs t
         SET price_per_km_ht = LEAST(COALESCE((_snapshot->>'price_per_km_ht')::numeric, 1.85), 3.00),
             minimum_ht = COALESCE((_snapshot->>'minimum_ht')::numeric, t.minimum_ht),
             pickup_pct = COALESCE((_snapshot->>'pickup_pct')::numeric, 0),
             night_enabled = COALESCE((_snapshot->>'night_enabled')::boolean, false),
             night_start = COALESCE((_snapshot->>'night_start')::time, t.night_start),
             night_end = COALESCE((_snapshot->>'night_end')::time, t.night_end),
             night_pct = COALESCE((_snapshot->>'night_pct')::numeric, t.night_pct),
             updated_at = now()
       WHERE t.driver_id = _driver;
    END IF;
  END IF;

  INSERT INTO public.driver_plan_changes
    (driver_id, old_plan, new_plan, old_billing_status, new_billing_status, reason, expires_at, changed_by, source)
  VALUES (_driver, _old_plan, _plan, _old_billing, _billing, _reason,
          CASE WHEN _plan = 'pro' THEN _expires_at END, _uid, 'admin');

  INSERT INTO public.audit_logs (actor_id, action, resource, resource_id, reason, old_value, new_value)
  VALUES (_uid, 'driver_plan_change', 'driver_profiles', _driver, _reason,
          jsonb_build_object('plan', _old_plan, 'billing_status', _old_billing),
          jsonb_build_object('plan', _plan, 'billing_status', _billing, 'expires_at', _expires_at));

  IF _plan = 'pro' THEN
    _title := 'Vous êtes passé à ReLink Pro';
    _body := 'Vos fonctionnalités Pro sont actives : tarifs personnalisés, courses planifiées, planning et outils avancés.';
  ELSE
    _title := 'Votre abonnement ReLink Pro a pris fin';
    _body := 'Votre compte repasse à ReLink Gratuit. Le tarif ReLink de 1,85 €/km s''applique de nouveau.';
  END IF;
  INSERT INTO public.notifications (user_id, title, body, kind, link)
  VALUES (_driver, _title, _body, 'info', '/pro/profil');

  RETURN jsonb_build_object('plan', _plan, 'billing_status', _billing, 'expires_at', _expires_at);
END; $$;

REVOKE ALL ON FUNCTION public.admin_set_driver_plan(uuid, text, text, text, timestamptz, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_driver_plan(uuid, text, text, text, timestamptz, boolean) TO authenticated;

-- Expiration automatique des accès Pro temporaires.
CREATE OR REPLACE FUNCTION public.expire_temporary_pro_plans()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _r record; _n integer := 0;
BEGIN
  FOR _r IN
    SELECT user_id, billing_status, pro_tariff_snapshot
    FROM public.driver_profiles
    WHERE plan = 'pro'
      AND plan_expires_at IS NOT NULL
      AND plan_expires_at <= now()
      AND billing_status <> 'active'
  LOOP
    UPDATE public.driver_profiles
       SET plan = 'free',
           billing_status = 'canceled',
           plan_expires_at = NULL,
           pro_tariff_snapshot = COALESCE(
             (SELECT to_jsonb(t) - 'driver_id' - 'created_at' - 'updated_at'
                FROM public.driver_tariffs t WHERE t.driver_id = _r.user_id),
             pro_tariff_snapshot)
     WHERE user_id = _r.user_id;

    UPDATE public.driver_tariffs
       SET price_per_km_ht = 1.85, pickup_pct = 0, night_enabled = false, updated_at = now()
     WHERE driver_id = _r.user_id;

    INSERT INTO public.driver_plan_changes
      (driver_id, old_plan, new_plan, old_billing_status, new_billing_status, reason, source)
    VALUES (_r.user_id, 'pro', 'free', _r.billing_status, 'canceled', 'Fin de l''accès Pro temporaire', 'system');

    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (_r.user_id, 'Fin de votre accès ReLink Pro',
            'Votre accès Pro temporaire est arrivé à échéance. Votre compte repasse à ReLink Gratuit.',
            'info', '/pro/profil');
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END; $$;

REVOKE ALL ON FUNCTION public.expire_temporary_pro_plans() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('relink-expire-pro-plans', '5 * * * *', $$SELECT public.expire_temporary_pro_plans();$$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'relink-expire-pro-plans');
