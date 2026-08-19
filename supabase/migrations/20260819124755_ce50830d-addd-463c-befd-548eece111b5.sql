REVOKE ALL ON FUNCTION public.recompute_invoice_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_invoice_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_invoice_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_ride_completed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_valid_siren(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_valid_siren(text) TO authenticated;