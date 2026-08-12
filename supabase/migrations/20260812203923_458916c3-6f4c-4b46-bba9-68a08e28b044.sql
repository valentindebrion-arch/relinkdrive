-- 1. Nouveau statut terminal
ALTER TYPE public.ride_status ADD VALUE IF NOT EXISTS 'expired';
