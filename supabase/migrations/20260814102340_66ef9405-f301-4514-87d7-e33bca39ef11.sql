ALTER TABLE public.driver_client_connections
  ADD CONSTRAINT conn_client_not_driver CHECK (client_id <> driver_id);

CREATE OR REPLACE FUNCTION public.guard_connection_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id = NEW.driver_id THEN
    RAISE EXCEPTION 'Un chauffeur ne peut pas se relier à lui-même';
  END IF;
  IF public.has_role(NEW.client_id, 'driver') OR public.has_role(NEW.client_id, 'admin') OR public.has_role(NEW.client_id, 'superadmin') THEN
    RAISE EXCEPTION 'Seul un compte client peut être relié à un chauffeur';
  END IF;
  IF NOT public.has_role(NEW.driver_id, 'driver') THEN
    RAISE EXCEPTION 'La relation doit cibler un compte chauffeur';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_connection_roles ON public.driver_client_connections;
CREATE TRIGGER trg_guard_connection_roles
BEFORE INSERT OR UPDATE OF client_id, driver_id ON public.driver_client_connections
FOR EACH ROW EXECUTE FUNCTION public.guard_connection_roles();

DROP POLICY IF EXISTS conn_insert_client ON public.driver_client_connections;
CREATE POLICY conn_insert_client ON public.driver_client_connections
FOR INSERT TO authenticated
WITH CHECK (
  client_id = auth.uid()
  AND client_id <> driver_id
  AND public.is_verified_driver(driver_id)
  AND NOT public.has_role(auth.uid(), 'driver')
);