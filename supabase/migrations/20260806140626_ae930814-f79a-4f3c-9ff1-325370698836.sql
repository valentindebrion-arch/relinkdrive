CREATE TABLE public.ride_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id)
);

GRANT SELECT, INSERT, UPDATE ON public.ride_reviews TO authenticated;
GRANT ALL ON public.ride_reviews TO service_role;

ALTER TABLE public.ride_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_select_participants" ON public.ride_reviews
FOR SELECT TO authenticated
USING (auth.uid() = client_id OR auth.uid() = driver_id OR public.is_admin(auth.uid()));

CREATE POLICY "review_insert_client" ON public.ride_reviews
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = client_id
  AND EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = ride_id AND r.client_id = auth.uid() AND r.driver_id = ride_reviews.driver_id
  )
);

CREATE POLICY "review_update_client" ON public.ride_reviews
FOR UPDATE TO authenticated
USING (auth.uid() = client_id)
WITH CHECK (auth.uid() = client_id);

CREATE TRIGGER trg_ride_reviews_updated
BEFORE UPDATE ON public.ride_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();