-- 1. Le chauffeur peut supprimer une mise en relation qui le concerne
DROP POLICY IF EXISTS conn_delete_driver ON public.driver_client_connections;
CREATE POLICY conn_delete_driver
  ON public.driver_client_connections
  FOR DELETE
  TO authenticated
  USING (driver_id = auth.uid() OR public.is_admin(auth.uid()));

-- 2. Documents de vérification : politiques explicites par commande
DROP POLICY IF EXISTS docs_own ON public.verification_documents;

CREATE POLICY docs_select_own
  ON public.verification_documents
  FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY docs_insert_own
  ON public.verification_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (driver_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY docs_update_own
  ON public.verification_documents
  FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (driver_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY docs_delete_own
  ON public.verification_documents
  FOR DELETE
  TO authenticated
  USING (driver_id = auth.uid() OR public.is_admin(auth.uid()));