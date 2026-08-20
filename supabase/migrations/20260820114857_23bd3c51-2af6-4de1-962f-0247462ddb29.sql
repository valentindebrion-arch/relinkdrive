-- 1. Ownership check on invoice_submission_events inserts
DROP POLICY IF EXISTS subev_insert ON public.invoice_submission_events;
CREATE POLICY subev_insert ON public.invoice_submission_events
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = driver_id
  AND EXISTS (
    SELECT 1 FROM public.invoice_submissions s
    WHERE s.id = invoice_submission_events.submission_id
      AND s.driver_id = auth.uid()
  )
);

-- 2. Public media exposure always follows verification status
CREATE OR REPLACE FUNCTION public.enforce_page_published_requires_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verification_status IS DISTINCT FROM 'verified'::public.verification_status THEN
    NEW.page_published := false;
    NEW.on_duty := false;
    NEW.accepting_requests := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_page_published_requires_verified ON public.driver_profiles;
CREATE TRIGGER trg_page_published_requires_verified
BEFORE INSERT OR UPDATE ON public.driver_profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_page_published_requires_verified();

UPDATE public.driver_profiles
   SET page_published = false, on_duty = false, accepting_requests = false
 WHERE verification_status IS DISTINCT FROM 'verified'::public.verification_status
   AND (page_published OR on_duty OR accepting_requests);
