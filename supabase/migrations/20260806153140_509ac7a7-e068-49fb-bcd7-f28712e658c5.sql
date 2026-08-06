-- 1. Invoice statuses
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'issued';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'overdue';