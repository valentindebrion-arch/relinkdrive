-- Rides completion details
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS mileage_km numeric,
  ADD COLUMN IF NOT EXISTS completion_note text;

-- Invoices extra fields
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS due_on date,
  ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false;

-- keep only the oldest invoice per ride, detach the duplicates
UPDATE public.invoices i SET ride_id = NULL
WHERE i.ride_id IS NOT NULL
  AND i.id <> (SELECT j.id FROM public.invoices j WHERE j.ride_id = i.ride_id ORDER BY j.created_at, j.id LIMIT 1);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_unique_ride ON public.invoices (ride_id) WHERE ride_id IS NOT NULL;
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq;

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL,
  client_id uuid,
  amount numeric NOT NULL,
  method text NOT NULL DEFAULT 'cash',
  paid_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_driver_all" ON public.payments;
CREATE POLICY "payments_driver_all" ON public.payments FOR ALL TO authenticated
  USING (auth.uid() = driver_id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = driver_id);
DROP POLICY IF EXISTS "payments_client_read" ON public.payments;
CREATE POLICY "payments_client_read" ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = client_id);

-- Reviews detail
ALTER TABLE public.ride_reviews
  ADD COLUMN IF NOT EXISTS punctuality_rating smallint,
  ADD COLUMN IF NOT EXISTS driving_rating smallint,
  ADD COLUMN IF NOT EXISTS cleanliness_rating smallint,
  ADD COLUMN IF NOT EXISTS service_rating smallint,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'visible';

CREATE UNIQUE INDEX IF NOT EXISTS ride_reviews_unique_ride_client ON public.ride_reviews (ride_id, client_id);

DO $$ BEGIN
  ALTER TABLE public.ride_reviews ADD CONSTRAINT ride_reviews_ratings_range CHECK (
    rating BETWEEN 1 AND 5
    AND (punctuality_rating IS NULL OR punctuality_rating BETWEEN 1 AND 5)
    AND (driving_rating IS NULL OR driving_rating BETWEEN 1 AND 5)
    AND (cleanliness_rating IS NULL OR cleanliness_rating BETWEEN 1 AND 5)
    AND (service_rating IS NULL OR service_rating BETWEEN 1 AND 5)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only reviews on completed rides, never by the driver himself
CREATE OR REPLACE FUNCTION public.guard_ride_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.rides%ROWTYPE;
BEGIN
  SELECT * INTO _r FROM public.rides WHERE id = NEW.ride_id;
  IF _r.id IS NULL OR _r.status <> 'completed' THEN
    RAISE EXCEPTION 'review only allowed on a completed ride';
  END IF;
  IF NOT public.is_admin(auth.uid()) THEN
    IF auth.uid() = _r.driver_id THEN
      RAISE EXCEPTION 'a driver cannot review his own ride';
    END IF;
    NEW.client_id := COALESCE(_r.client_id, auth.uid());
    NEW.driver_id := _r.driver_id;
    NEW.status := COALESCE(OLD.status, 'visible');
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_ride_review() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_ride_review ON public.ride_reviews;
CREATE TRIGGER trg_guard_ride_review BEFORE INSERT OR UPDATE ON public.ride_reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_ride_review();

-- Automation on ride completion
CREATE OR REPLACE FUNCTION public.on_ride_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _vat numeric := 0;
  _ht numeric;
  _number text;
  _status public.invoice_status;
  _completed int;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' OR NEW.is_block THEN
    RETURN NEW;
  END IF;

  SELECT CASE WHEN vat_applicable THEN 10 ELSE 0 END INTO _vat
  FROM public.driver_profiles WHERE user_id = NEW.driver_id;
  _vat := COALESCE(_vat, 0);
  _ht := COALESCE(NEW.price, 0);

  IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE ride_id = NEW.id) THEN
    _number := 'F-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.invoice_number_seq')::text, 6, '0');
    _status := CASE WHEN _ht > 0 AND NEW.client_id IS NOT NULL THEN 'issued'::public.invoice_status
                    ELSE 'draft'::public.invoice_status END;
    INSERT INTO public.invoices (
      ride_id, driver_id, client_id, number, issued_on, description,
      amount_ht, vat_rate, amount_ttc, status, payment_method, due_on, auto_generated
    ) VALUES (
      NEW.id, NEW.driver_id, NEW.client_id, _number, current_date,
      'Course du ' || to_char(COALESCE(NEW.completed_at, now()), 'DD/MM/YYYY') || ' — ' ||
        NEW.pickup_address || ' → ' || NEW.dropoff_address,
      _ht, _vat, round(_ht * (1 + _vat / 100), 2), _status,
      NEW.payment_method, current_date + 30, true
    );

    IF NEW.client_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.client_id,
              CASE WHEN _status = 'issued' THEN 'Votre facture est disponible' ELSE 'Course terminée' END,
              'Retrouvez le détail de votre course et votre facture.', 'invoice', '/espace/suivi/' || NEW.id);
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.client_id, 'Donnez votre avis',
              'Comment s''est passée votre course ? Votre avis aide votre chauffeur.', 'info', '/espace/avis/' || NEW.id);
    END IF;
  END IF;

  -- CRM refresh
  IF NEW.client_id IS NOT NULL THEN
    SELECT count(*) INTO _completed FROM public.rides
    WHERE driver_id = NEW.driver_id AND client_id = NEW.client_id AND status = 'completed';
    UPDATE public.driver_client_connections
      SET crm_status = CASE WHEN _completed >= 3 THEN 'regular'::public.crm_status ELSE 'active'::public.crm_status END
    WHERE driver_id = NEW.driver_id AND client_id = NEW.client_id;
  END IF;

  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.on_ride_completed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_on_ride_completed ON public.rides;
CREATE TRIGGER trg_on_ride_completed AFTER UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.on_ride_completed();