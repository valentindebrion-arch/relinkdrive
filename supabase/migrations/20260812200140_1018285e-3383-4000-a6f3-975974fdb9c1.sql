CREATE TABLE public.ride_request_terms_acceptances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.ride_requests(id) ON DELETE CASCADE,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  cgu_version text NOT NULL,
  cgv_version text NOT NULL,
  cancellation_version text,
  UNIQUE (request_id)
);

GRANT SELECT, INSERT ON public.ride_request_terms_acceptances TO authenticated;
GRANT ALL ON public.ride_request_terms_acceptances TO service_role;

ALTER TABLE public.ride_request_terms_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients insert their own acceptance"
ON public.ride_request_terms_acceptances
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.ride_requests r
    WHERE r.id = request_id AND r.client_id = auth.uid()
  )
);

CREATE POLICY "Clients read their own acceptance"
ON public.ride_request_terms_acceptances
FOR SELECT TO authenticated
USING (user_id = auth.uid());