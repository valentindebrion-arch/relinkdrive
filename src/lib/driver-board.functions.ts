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

    // Nom réel du client : la course ne stocke qu'un client_id (et parfois un
    // libellé libre). get_connected_profiles renvoie le nom et le téléphone au
    // chauffeur réellement lié au client — même source que le planning.
    const clientIds = Array.from(
      new Set((ridesRes.data ?? []).map((r: any) => r.client_id).filter((id: any): id is string => !!id)),
    );
    const names = new Map<string, string>();
    const phones = new Map<string, string>();
    if (clientIds.length) {
      const { data: clients } = await supabase.rpc("get_connected_profiles", { _ids: clientIds });
      ((clients ?? []) as any[]).forEach((c) => {
        const label = (c.full_name ?? "").trim();
        if (label) names.set(c.id, label);
        const phone = (c.phone ?? "").trim();
        if (phone) phones.set(c.id, phone);
      });
    }

    const rides = (ridesRes.data ?? []).map((r: any) => ({
      ...r,
      ride_type: r.ride_type === "flash" ? "flash" : "scheduled",
      price: r.price === null ? null : Number(r.price),
      client_label: (r.client_id ? names.get(r.client_id) : null) ?? (r.client_label?.trim() || null),
      client_phone: r.client_id ? (phones.get(r.client_id) ?? null) : null,
    })) as BoardRide[];

    const requests = (requestsRes.data ?? []).map((r) => ({
      ...r,
      ride_type: r.ride_type === "flash" ? "flash" : "scheduled",
      proposed_price: r.proposed_price === null ? null : Number(r.proposed_price),
    })) as BoardRequest[];

    return { nowIso: now.toISOString(), ...classifyDriverRides(rides, requests, now) };
  });
