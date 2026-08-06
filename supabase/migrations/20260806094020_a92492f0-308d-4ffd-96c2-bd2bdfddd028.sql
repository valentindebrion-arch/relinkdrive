-- ENUMS
CREATE TYPE public.app_role AS ENUM ('client','driver','admin','superadmin');
CREATE TYPE public.verification_status AS ENUM ('incomplete','pending','verified','changes_requested','rejected','suspended');
CREATE TYPE public.document_status AS ENUM ('pending','approved','rejected','expired');
CREATE TYPE public.account_status AS ENUM ('active','email_unverified','phone_unverified','restricted','suspended','deleted');
CREATE TYPE public.ride_status AS ENUM ('new','reviewing','proposal_sent','awaiting_client','confirmed','driver_enroute','driver_arrived','client_onboard','in_progress','completed','cancelled','refused');
CREATE TYPE public.crm_status AS ENUM ('new','active','regular','inactive');
CREATE TYPE public.invoice_status AS ENUM ('draft','sent','paid','cancelled');
CREATE TYPE public.report_status AS ENUM ('new','in_progress','waiting','resolved','closed');

-- UTIL
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  status public.account_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','superadmin'));
$$;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email, NEW.raw_user_meta_data->>'phone');
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'client');
  IF _role IN ('admin','superadmin') THEN _role := 'client'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  IF _role = 'driver' THEN
    INSERT INTO public.driver_profiles (user_id, slug)
    VALUES (NEW.id, 'chauffeur-' || substr(replace(NEW.id::text,'-',''),1,8));
  END IF;
  RETURN NEW;
END; $$;

-- DRIVER PROFILES
CREATE TABLE public.driver_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  business_name TEXT,
  bio TEXT,
  professional_address TEXT,
  city TEXT,
  zone TEXT,
  languages TEXT[] NOT NULL DEFAULT '{}',
  services TEXT[] NOT NULL DEFAULT '{}',
  siret TEXT,
  vtc_card_number TEXT,
  billing_legal_info TEXT,
  vat_applicable BOOLEAN NOT NULL DEFAULT false,
  verification_status public.verification_status NOT NULL DEFAULT 'incomplete',
  admin_note TEXT,
  rejection_reason TEXT,
  page_published BOOLEAN NOT NULL DEFAULT false,
  on_duty BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.driver_profiles TO authenticated;
GRANT SELECT ON public.driver_profiles TO anon;
GRANT ALL ON public.driver_profiles TO service_role;
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_public_page" ON public.driver_profiles FOR SELECT USING (verification_status = 'verified');
CREATE POLICY "driver_select_own" ON public.driver_profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "driver_insert_own" ON public.driver_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "driver_update_own" ON public.driver_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_driver_profiles_updated BEFORE UPDATE ON public.driver_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- COMPANIES
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  legal_name TEXT,
  legal_form TEXT,
  siret TEXT,
  vat_number TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_own" ON public.companies FOR ALL TO authenticated USING (driver_id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (driver_id = auth.uid() OR public.is_admin(auth.uid()));

-- VEHICLES
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand TEXT, model TEXT, year INT, color TEXT, plate TEXT,
  max_passengers INT NOT NULL DEFAULT 4,
  luggage_capacity INT NOT NULL DEFAULT 2,
  photo_url TEXT,
  mileage INT,
  next_service_date DATE,
  insurance_provider TEXT, insurance_expires_at DATE,
  inspection_expires_at DATE,
  equipments TEXT[] NOT NULL DEFAULT '{}',
  child_seat BOOLEAN NOT NULL DEFAULT false,
  chargers BOOLEAN NOT NULL DEFAULT false,
  water BOOLEAN NOT NULL DEFAULT false,
  pets_allowed BOOLEAN NOT NULL DEFAULT false,
  accessible BOOLEAN NOT NULL DEFAULT false,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT SELECT ON public.vehicles TO anon;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles_public_for_verified" ON public.vehicles FOR SELECT USING (EXISTS (SELECT 1 FROM public.driver_profiles d WHERE d.user_id = vehicles.driver_id AND d.verification_status = 'verified'));
CREATE POLICY "vehicles_own" ON public.vehicles FOR ALL TO authenticated USING (driver_id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (driver_id = auth.uid() OR public.is_admin(auth.uid()));

-- DOCUMENTS
CREATE TABLE public.verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  file_path TEXT,
  status public.document_status NOT NULL DEFAULT 'pending',
  expires_at DATE,
  review_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_documents TO authenticated;
GRANT ALL ON public.verification_documents TO service_role;
ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_own" ON public.verification_documents FOR ALL TO authenticated USING (driver_id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (driver_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.document_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.verification_documents(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  decision public.document_status NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.document_reviews TO authenticated;
GRANT ALL ON public.document_reviews TO service_role;
ALTER TABLE public.document_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_reviews_admin" ON public.document_reviews FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- CONNECTIONS
CREATE TABLE public.driver_client_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'link',
  crm_status public.crm_status NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, driver_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_client_connections TO authenticated;
GRANT ALL ON public.driver_client_connections TO service_role;
ALTER TABLE public.driver_client_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conn_select" ON public.driver_client_connections FOR SELECT TO authenticated USING (client_id = auth.uid() OR driver_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "conn_insert_client" ON public.driver_client_connections FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid() AND EXISTS (SELECT 1 FROM public.driver_profiles d WHERE d.user_id = driver_id AND d.verification_status = 'verified'));
CREATE POLICY "conn_update" ON public.driver_client_connections FOR UPDATE TO authenticated USING (driver_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "conn_delete_client" ON public.driver_client_connections FOR DELETE TO authenticated USING (client_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_connected(_client UUID, _driver UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.driver_client_connections WHERE client_id = _client AND driver_id = _driver);
$$;

-- CLIENT ADDRESSES
CREATE TABLE public.client_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_addresses TO authenticated;
GRANT ALL ON public.client_addresses TO service_role;
ALTER TABLE public.client_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addr_own" ON public.client_addresses FOR ALL TO authenticated USING (client_id = auth.uid()) WITH CHECK (client_id = auth.uid());

-- RIDE REQUESTS
CREATE TABLE public.ride_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  passengers INT NOT NULL DEFAULT 1,
  luggage INT NOT NULL DEFAULT 0,
  round_trip BOOLEAN NOT NULL DEFAULT false,
  trip_type TEXT,
  special_needs TEXT,
  comment TEXT,
  preferred_contact TEXT,
  status public.ride_status NOT NULL DEFAULT 'new',
  proposed_price NUMERIC(10,2),
  proposed_time TIMESTAMPTZ,
  driver_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ride_requests TO authenticated;
GRANT ALL ON public.ride_requests TO service_role;
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "req_select" ON public.ride_requests FOR SELECT TO authenticated USING (client_id = auth.uid() OR driver_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "req_insert_client" ON public.ride_requests FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid() AND public.is_connected(auth.uid(), driver_id));
CREATE POLICY "req_update" ON public.ride_requests FOR UPDATE TO authenticated USING (client_id = auth.uid() OR driver_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON public.ride_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RIDES
CREATE TABLE public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.ride_requests(id) ON DELETE SET NULL,
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_label TEXT,
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  price NUMERIC(10,2),
  passengers INT NOT NULL DEFAULT 1,
  status public.ride_status NOT NULL DEFAULT 'confirmed',
  is_block BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rides TO authenticated;
GRANT ALL ON public.rides TO service_role;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rides_select" ON public.rides FOR SELECT TO authenticated USING (client_id = auth.uid() OR driver_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "rides_insert_driver" ON public.rides FOR INSERT TO authenticated WITH CHECK (driver_id = auth.uid());
CREATE POLICY "rides_update" ON public.rides FOR UPDATE TO authenticated USING (driver_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "rides_delete_driver" ON public.rides FOR DELETE TO authenticated USING (driver_id = auth.uid());
CREATE TRIGGER trg_rides_updated BEFORE UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ride_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.ride_requests(id) ON DELETE CASCADE,
  status public.ride_status NOT NULL,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ride_status_history TO authenticated;
GRANT ALL ON public.ride_status_history TO service_role;
ALTER TABLE public.ride_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history_select" ON public.ride_status_history FOR SELECT TO authenticated USING (
  public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND (r.driver_id = auth.uid() OR r.client_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM public.ride_requests q WHERE q.id = request_id AND (q.driver_id = auth.uid() OR q.client_id = auth.uid()))
);
CREATE POLICY "history_insert" ON public.ride_status_history FOR INSERT TO authenticated WITH CHECK (changed_by = auth.uid());

-- LIVE LOCATIONS
CREATE TABLE public.live_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'driver',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  is_simulated BOOLEAN NOT NULL DEFAULT false,
  consent BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_locations TO authenticated;
GRANT ALL ON public.live_locations TO service_role;
ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loc_select" ON public.live_locations FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND (r.client_id = auth.uid() OR r.driver_id = auth.uid()))
);
CREATE POLICY "loc_write_own" ON public.live_locations FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- INVOICES
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  number TEXT NOT NULL,
  issued_on DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  amount_ht NUMERIC(10,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  amount_ttc NUMERIC(10,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_select" ON public.invoices FOR SELECT TO authenticated USING (driver_id = auth.uid() OR client_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "inv_insert_driver" ON public.invoices FOR INSERT TO authenticated WITH CHECK (driver_id = auth.uid());
CREATE POLICY "inv_update_driver" ON public.invoices FOR UPDATE TO authenticated USING (driver_id = auth.uid() OR public.is_admin(auth.uid()));

-- DRIVER NOTES (private)
CREATE TABLE public.driver_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_notes TO authenticated;
GRANT ALL ON public.driver_notes TO service_role;
ALTER TABLE public.driver_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_driver_only" ON public.driver_notes FOR ALL TO authenticated USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());

-- REPORTS
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  description TEXT,
  status public.report_status NOT NULL DEFAULT 'new',
  assigned_admin UUID,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_select" ON public.reports FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "reports_insert" ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reports_update_admin" ON public.reports FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  kind TEXT NOT NULL DEFAULT 'info',
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  resource TEXT,
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_read" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- ANALYTICS EVENTS
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  driver_id UUID,
  client_id UUID,
  city TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.analytics_events TO authenticated;
GRANT INSERT ON public.analytics_events TO anon;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_insert_all" ON public.analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "events_admin_read" ON public.analytics_events FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE INDEX idx_conn_client ON public.driver_client_connections(client_id);
CREATE INDEX idx_conn_driver ON public.driver_client_connections(driver_id);
CREATE INDEX idx_req_driver ON public.ride_requests(driver_id);
CREATE INDEX idx_rides_driver ON public.rides(driver_id, scheduled_at);