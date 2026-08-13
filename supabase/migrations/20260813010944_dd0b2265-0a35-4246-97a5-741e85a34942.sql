ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'expired_documents';