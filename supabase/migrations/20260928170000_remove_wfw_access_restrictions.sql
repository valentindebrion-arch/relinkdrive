-- Woman for Woman reste un label et un thème de vitrine, sans restriction
-- de visibilité, de consultation ou de mise en relation.

CREATE OR REPLACE FUNCTION public.wfw_relation_allowed(_client uuid, _driver uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT true;
$function$;

REVOKE ALL ON FUNCTION public.wfw_relation_allowed(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wfw_relation_allowed(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.driver_page_access(_slug text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.driver_profiles d
      WHERE d.slug = _slug AND d.page_published
    ) THEN 'ok'
    ELSE 'missing'
  END;
$function$;

REVOKE ALL ON FUNCTION public.driver_page_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_page_access(text) TO anon, authenticated, service_role;
