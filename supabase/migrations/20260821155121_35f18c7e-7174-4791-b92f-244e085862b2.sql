ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS photo_trunk_url text,
  ADD COLUMN IF NOT EXISTS photo_child_seat_url text,
  ADD COLUMN IF NOT EXISTS photo_access_url text,
  ADD COLUMN IF NOT EXISTS photo_pet_url text;