CREATE OR REPLACE FUNCTION public.get_invoice_issuer(_driver uuid)
RETURNS TABLE(full_name text, business_name text, siret text, vtc_card_number text, professional_address text, billing_legal_info text, vat_applicable boolean, public_phone text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.full_name, d.business_name, d.siret, d.vtc_card_number,
         d.professional_address, d.billing_legal_info, d.vat_applicable,
         CASE WHEN d.show_public_phone THEN d.public_phone END, p.email
  FROM public.driver_profiles d
  JOIN public.profiles p ON p.id = d.user_id
  WHERE d.user_id = _driver
    AND (
      auth.uid() = _driver
      OR public.is_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.driver_id = _driver AND i.client_id = auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.get_invoice_issuer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_invoice_issuer(uuid) TO authenticated;