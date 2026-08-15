import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  classifyDriverRides,
  type BoardRequest,
  type BoardRide,
  type DriverBoard,
} from "@/lib/driver-board";

const RIDE_COLUMNS =
  "id, ride_type, status, scheduled_at, pickup_address, dropoff_address, client_label, client_id, price, passengers, notes, started_at, completed_at, payment_method, cancel_request_status";

const REQUEST_COLUMNS =
  "id, ride_type, status, scheduled_at, created_at, pickup_address, dropoff_address, proposed_price";

/**
 * Source unique du classement des courses du chauffeur connecté.
 * Le calcul utilise toujours l'heure serveur : aucune catégorie ne dépend
 * de l'horloge du navigateur ni d'un cache local.
 */
export const getDriverBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DriverBoard> => {
    const { supabase, userId } = context;
    const now = new Date();

    const [ridesRes, requestsRes] = await Promise.all([
      supabase
        .from("rides")
        .select(RIDE_COLUMNS)
        .eq("driver_id", userId)
        .eq("is_block", false)
        .in("status", ["confirmed", "driver_enroute", "driver_arrived", "client_onboard", "in_progress"])
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("ride_requests")
        .select(REQUEST_COLUMNS)
        .eq("driver_id", userId)
        .in("status", ["new", "reviewing", "proposal_sent", "awaiting_client"])
        .order("created_at", { ascending: false }),
    ]);

    if (ridesRes.error) throw new Error(ridesRes.error.message);
    if (requestsRes.error) throw new Error(requestsRes.error.message);

    const rides = (ridesRes.data ?? []).map((r) => ({
      ...r,
      ride_type: r.ride_type === "flash" ? "flash" : "scheduled",
      price: r.price === null ? null : Number(r.price),
    })) as BoardRide[];

    const requests = (requestsRes.data ?? []).map((r) => ({
      ...r,
      ride_type: r.ride_type === "flash" ? "flash" : "scheduled",
      proposed_price: r.proposed_price === null ? null : Number(r.proposed_price),
    })) as BoardRequest[];

    return { nowIso: now.toISOString(), ...classifyDriverRides(rides, requests, now) };
  });
