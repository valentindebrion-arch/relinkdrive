CREATE OR REPLACE FUNCTION public.guard_report_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    NEW.status := 'new';
    NEW.assigned_admin := NULL;
    NEW.resolution := NULL;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_report_insert ON public.reports;
CREATE TRIGGER trg_guard_report_insert
BEFORE INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.guard_report_insert();

REVOKE EXECUTE ON FUNCTION public.guard_report_insert() FROM PUBLIC, anon, authenticated;