
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS cancelled_by_role text,
  ADD COLUMN IF NOT EXISTS admin_cancellation_comment text,
  ADD COLUMN IF NOT EXISTS previous_status text;

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancelled_by_role text,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS admin_cancellation_comment text,
  ADD COLUMN IF NOT EXISTS previous_status text;

CREATE OR REPLACE FUNCTION public.admin_cancel_ride(
  _ride uuid,
  _reason text,
  _admin_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _now timestamptz := now();
  _ride_row public.rides%ROWTYPE;
  _req public.ride_requests%ROWTYPE;
  _prev text;
  _paid int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_admin(_uid) THEN RAISE EXCEPTION 'admin role required'; END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN RAISE EXCEPTION 'motif obligatoire'; END IF;
  IF _reason = 'other' AND (_admin_comment IS NULL OR btrim(_admin_comment) = '') THEN
    RAISE EXCEPTION 'commentaire obligatoire pour le motif « autre »';
  END IF;

  SELECT * INTO _ride_row FROM public.rides WHERE id = _ride FOR UPDATE;

  IF FOUND THEN
    IF _ride_row.is_block THEN RAISE EXCEPTION 'cet élément n''est pas une course'; END IF;

    IF _ride_row.status = 'cancelled' THEN
      RETURN jsonb_build_object('kind','ride','id',_ride_row.id,'status','cancelled','already',true);
    END IF;
    IF _ride_row.status IN ('completed','refused','expired') THEN
      RAISE EXCEPTION 'cette course est terminée (%) et ne peut pas être annulée', _ride_row.status;
    END IF;

    SELECT count(*) INTO _paid FROM public.invoices
      WHERE ride_id = _ride_row.id AND status = 'paid';
    IF _paid > 0 THEN
      RAISE EXCEPTION 'cette course est déjà payée : traitement administratif spécifique requis';
    END IF;

    _prev := _ride_row.status::text;

    UPDATE public.rides SET
      status = 'cancelled',
      previous_status = _prev,
      cancelled_at = _now,
      cancelled_by = _uid,
      cancelled_by_role = 'admin',
      cancellation_reason = _reason,
      admin_cancellation_comment = NULLIF(btrim(COALESCE(_admin_comment,'')),''),
      cancel_request_status = CASE WHEN cancel_request_status = 'pending' THEN 'accepted' ELSE cancel_request_status END,
      cancel_decided_at = CASE WHEN cancel_request_status = 'pending' THEN _now ELSE cancel_decided_at END,
      cancel_decided_by = CASE WHEN cancel_request_status = 'pending' THEN _uid ELSE cancel_decided_by END,
      updated_at = _now
    WHERE id = _ride_row.id;

    INSERT INTO public.ride_status_history (ride_id, request_id, status, changed_by)
    VALUES (_ride_row.id, _ride_row.request_id, 'cancelled', _uid);

    -- Libère la demande associée pour débloquer le client
    IF _ride_row.request_id IS NOT NULL THEN
      UPDATE public.ride_requests SET
        status = 'cancelled',
        previous_status = status::text,
        cancelled_at = _now,
        cancelled_by = _uid,
        cancelled_by_role = 'admin',
        cancellation_reason = _reason,
        admin_cancellation_comment = NULLIF(btrim(COALESCE(_admin_comment,'')),''),
        response_deadline = NULL,
        updated_at = _now
      WHERE id = _ride_row.request_id AND status NOT IN ('cancelled','completed','expired','refused');
    END IF;

    -- Aucune facture finale pour une course interrompue
    UPDATE public.invoices SET status = 'cancelled', updated_at = _now
      WHERE ride_id = _ride_row.id AND status <> 'paid';

    IF _ride_row.client_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (_ride_row.client_id, 'Course annulée par ReLink',
              'Votre course a été annulée par ReLink. Vous pouvez effectuer une nouvelle demande.',
              'ride', '/espace/suivi/' || _ride_row.id);
    END IF;
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (_ride_row.driver_id, 'Course annulée par ReLink',
            'La course a été annulée par ReLink et retirée de vos courses en cours.',
            'ride', '/pro/courses/' || _ride_row.id);

    INSERT INTO public.audit_logs (actor_id, action, resource, resource_id, old_value, new_value, reason)
    VALUES (_uid, 'admin_cancel_ride', 'rides', _ride_row.id,
            jsonb_build_object('status', _prev),
            jsonb_build_object('status','cancelled','cancelled_by_role','admin',
                               'client_id', _ride_row.client_id, 'driver_id', _ride_row.driver_id,
                               'admin_comment', _admin_comment, 'result','ok'),
            _reason);

    RETURN jsonb_build_object('kind','ride','id',_ride_row.id,'status','cancelled',
                              'previous_status',_prev,'already',false);
  END IF;

  -- Sinon : demande de course
  SELECT * INTO _req FROM public.ride_requests WHERE id = _ride FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'course introuvable'; END IF;

  IF _req.status = 'cancelled' THEN
    RETURN jsonb_build_object('kind','request','id',_req.id,'status','cancelled','already',true);
  END IF;
  IF _req.status IN ('completed','refused','expired') THEN
    RAISE EXCEPTION 'cette demande est terminée (%) et ne peut pas être annulée', _req.status;
  END IF;

  _prev := _req.status::text;

  UPDATE public.ride_requests SET
    status = 'cancelled',
    previous_status = _prev,
    cancelled_at = _now,
    cancelled_by = _uid,
    cancelled_by_role = 'admin',
    cancellation_reason = _reason,
    admin_cancellation_comment = NULLIF(btrim(COALESCE(_admin_comment,'')),''),
    response_deadline = NULL,
    updated_at = _now
  WHERE id = _req.id;

  INSERT INTO public.ride_status_history (request_id, status, changed_by)
  VALUES (_req.id, 'cancelled', _uid);

  INSERT INTO public.notifications (user_id, title, body, kind, link)
  VALUES (_req.client_id, 'Demande annulée par ReLink',
          'Votre course a été annulée par ReLink. Vous pouvez effectuer une nouvelle demande.',
          'request', '/espace/suivi/' || _req.id);
  INSERT INTO public.notifications (user_id, title, body, kind, link)
  VALUES (_req.driver_id, 'Demande annulée par ReLink',
          'La course a été annulée par ReLink et retirée de vos courses en cours.',
          'request', '/pro/demandes');

  INSERT INTO public.audit_logs (actor_id, action, resource, resource_id, old_value, new_value, reason)
  VALUES (_uid, 'admin_cancel_ride', 'ride_requests', _req.id,
          jsonb_build_object('status', _prev),
          jsonb_build_object('status','cancelled','cancelled_by_role','admin',
                             'client_id', _req.client_id, 'driver_id', _req.driver_id,
                             'admin_comment', _admin_comment, 'result','ok'),
          _reason);

  RETURN jsonb_build_object('kind','request','id',_req.id,'status','cancelled',
                            'previous_status',_prev,'already',false);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_cancel_ride(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_ride(uuid, text, text) TO authenticated;
