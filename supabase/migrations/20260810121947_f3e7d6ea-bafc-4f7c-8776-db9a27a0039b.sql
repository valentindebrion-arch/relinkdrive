ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS cancel_request_status text,
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_requested_by uuid,
  ADD COLUMN IF NOT EXISTS cancel_request_reason text,
  ADD COLUMN IF NOT EXISTS cancel_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_decided_by uuid,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

ALTER TABLE public.rides
  DROP CONSTRAINT IF EXISTS rides_cancel_request_status_check;
ALTER TABLE public.rides
  ADD CONSTRAINT rides_cancel_request_status_check
  CHECK (cancel_request_status IS NULL OR cancel_request_status IN ('pending','accepted','refused'));

CREATE INDEX IF NOT EXISTS rides_cancel_request_status_idx
  ON public.rides (driver_id, cancel_request_status)
  WHERE cancel_request_status = 'pending';