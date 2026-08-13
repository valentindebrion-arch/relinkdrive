CREATE TABLE public.driver_dossier_details (
  driver_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_date date,
  postal_address text,
  id_doc_type text,
  id_doc_expires_on date,
  license_number text,
  license_categories text,
  license_issued_on date,
  license_expires_on date,
  vtc_issued_on date,
  vtc_expires_on date,
  vtc_authority text,
  trade_name text,
  siren text,
  revtc_number text,
  rc_company text,
  rc_contract text,
  rc_starts_on date,
  rc_expires_on date,
  auto_company text,
  auto_contract text,
  auto_plate text,
  auto_starts_on date,
  auto_expires_on date,
  registration_holder text,
  certified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.driver_dossier_details TO authenticated;
GRANT ALL ON public.driver_dossier_details TO service_role;

ALTER TABLE public.driver_dossier_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers manage their own dossier details"
ON public.driver_dossier_details FOR ALL TO authenticated
USING (auth.uid() = driver_id)
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Admins can read dossier details"
ON public.driver_dossier_details FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_driver_dossier_details_updated_at
BEFORE UPDATE ON public.driver_dossier_details
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();