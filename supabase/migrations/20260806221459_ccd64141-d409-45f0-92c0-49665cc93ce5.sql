CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_enabled boolean NOT NULL DEFAULT false;

-- 1. notify_counterparty devient inerte (les triggers gèrent tout, plus de doublons)
CREATE OR REPLACE FUNCTION public.notify_counterparty(_recipient uuid, _kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN;
END; $$;

-- 2. une seule notification par changement d'étape de course
CREATE OR REPLACE FUNCTION public.notify_ride_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _label text; _title text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.client_id IS NOT NULL AND NOT NEW.is_block THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.client_id, 'Course confirmée',
              'Votre chauffeur a confirmé la course.', 'ride', '/espace/suivi/' || NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.client_id IS NOT NULL AND NOT NEW.is_block THEN
    _label := CASE NEW.status
      WHEN 'driver_enroute' THEN 'Votre chauffeur est en route.'
      WHEN 'driver_arrived' THEN 'Votre chauffeur est arrivé au point de rendez-vous.'
      WHEN 'client_onboard' THEN 'Vous êtes à bord, bonne route !'
      WHEN 'in_progress' THEN 'Votre course a démarré.'
      WHEN 'completed' THEN 'Votre course est terminée. Merci !'
      WHEN 'cancelled' THEN 'Votre course a été annulée.'
      ELSE NULL END;
    _title := CASE NEW.status
      WHEN 'driver_enroute' THEN 'Chauffeur en route'
      WHEN 'driver_arrived' THEN 'Chauffeur arrivé'
      WHEN 'client_onboard' THEN 'Prise en charge'
      WHEN 'in_progress' THEN 'Course en cours'
      WHEN 'completed' THEN 'Course terminée'
      WHEN 'cancelled' THEN 'Course annulée'
      ELSE NULL END;
    IF _label IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.client_id, _title, _label, 'ride', '/espace/suivi/' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- 3. demandes : notifier uniquement l'autre partie
CREATE OR REPLACE FUNCTION public.notify_request_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (NEW.driver_id, 'Nouvelle demande de trajet',
            'Un client vous a envoyé une demande de trajet.', 'request', '/pro/demandes');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() = NEW.client_id THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.driver_id, 'Demande mise à jour',
              'Le client a mis à jour sa demande.', 'request', '/pro/demandes');
    ELSE
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.client_id, 'Demande mise à jour',
              'Le statut de votre demande a changé : ' || NEW.status, 'request', '/espace/suivi/' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- 4. fin de course : plus de doublon "Course terminée"
CREATE OR REPLACE FUNCTION public.on_ride_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

    IF NEW.client_id IS NOT NULL AND _status = 'issued' THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (NEW.client_id, 'Votre facture est disponible',
              'Retrouvez le détail de votre course et votre facture.', 'invoice', '/espace/suivi/' || NEW.id);
    END IF;
  END IF;

  IF NEW.client_id IS NOT NULL THEN
    SELECT count(*) INTO _completed FROM public.rides
    WHERE driver_id = NEW.driver_id AND client_id = NEW.client_id AND status = 'completed';
    UPDATE public.driver_client_connections
      SET crm_status = CASE WHEN _completed >= 3 THEN 'regular'::public.crm_status ELSE 'active'::public.crm_status END
    WHERE driver_id = NEW.driver_id AND client_id = NEW.client_id;
  END IF;

  RETURN NEW;
END; $$;

-- 5. envoi push à chaque notification créée
CREATE OR REPLACE FUNCTION public.dispatch_push_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'net', 'extensions' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.user_id AND p.push_enabled)
     AND EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = NEW.user_id) THEN
    PERFORM net.http_post(
      url := 'https://relinkdriver.lovable.app/api/public/push',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-push-secret', 'ee259325c36893a39048dfc7a270347def2f13d161794a96'),
      body := jsonb_build_object('notification_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_dispatch_push_notification ON public.notifications;
CREATE TRIGGER trg_dispatch_push_notification
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_notification();