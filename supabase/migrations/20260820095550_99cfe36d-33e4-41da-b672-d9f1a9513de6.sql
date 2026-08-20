DROP POLICY IF EXISTS conn_update ON public.driver_client_connections;

CREATE POLICY conn_update ON public.driver_client_connections
FOR UPDATE TO authenticated
USING ((driver_id = auth.uid()) OR public.is_admin(auth.uid()))
WITH CHECK ((driver_id = auth.uid()) OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_connection_immutable_parties()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.client_id <> OLD.client_id OR NEW.driver_id <> OLD.driver_id THEN
    RAISE EXCEPTION 'connection_parties_immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_connection_immutable_parties ON public.driver_client_connections;
CREATE TRIGGER trg_connection_immutable_parties
BEFORE UPDATE ON public.driver_client_connections
FOR EACH ROW EXECUTE FUNCTION public.guard_connection_immutable_parties();