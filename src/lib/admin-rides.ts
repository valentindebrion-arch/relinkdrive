import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Statuts actifs côté demandes (avant création de la course). */
export const ACTIVE_REQUEST_STATUSES = ["new", "reviewing", "proposal_sent", "awaiting_client"] as const;
/** Statuts actifs côté course confirmée. */
export const ACTIVE_RIDE_STATUSES = [
  "confirmed",
  "driver_enroute",
  "driver_arrived",
  "client_onboard",
  "in_progress",
] as const;

export const CLOSED_STATUSES = ["completed", "cancelled", "refused", "expired"] as const;

export const ADMIN_CANCEL_REASONS = [
  { value: "technical", label: "Problème technique" },
  { value: "client_request", label: "Demande du client" },
  { value: "driver_request", label: "Demande du chauffeur" },
  { value: "booking_error", label: "Erreur de réservation" },
  { value: "safety", label: "Problème de sécurité signalé" },
  { value: "fraud", label: "Fraude ou comportement suspect" },
  { value: "unavailable", label: "Indisponibilité exceptionnelle" },
  { value: "other", label: "Autre" },
] as const;

export function adminCancelReasonLabel(value?: string | null) {
  if (!value) return null;
  return ADMIN_CANCEL_REASONS.find((r) => r.value === value)?.label ?? value;
}

export type AdminRideItem = {
  kind: "ride" | "request";
  id: string;
  rideId: string | null;
  requestId: string | null;
  status: string;
  isImmediate: boolean;
  createdAt: string;
  scheduledAt: string;
  responseDeadline: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledByRole: string | null;
  cancellationReason: string | null;
  clientId: string | null;
  driverId: string | null;
  clientName: string;
  driverName: string;
  pickup: string;
  dropoff: string;
  price: number | null;
  source: string;
};

function elapsedLabel(fromIso: string) {
  const ms = Date.now() - new Date(fromIso).getTime();
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${min % 60} min`;
  return `${Math.floor(h / 24)} j`;
}

export const elapsedSince = elapsedLabel;

export function isActive(item: AdminRideItem) {
  return item.kind === "ride"
    ? (ACTIVE_RIDE_STATUSES as readonly string[]).includes(item.status)
    : (ACTIVE_REQUEST_STATUSES as readonly string[]).includes(item.status);
}

/** Une course « planifiée » : active, non immédiate et prévue à plus de 2 h. */
export function isPlanned(item: AdminRideItem) {
  return (
    isActive(item) &&
    !item.isImmediate &&
    !item.startedAt &&
    new Date(item.scheduledAt).getTime() > Date.now() + 2 * 3600_000
  );
}

export const ADMIN_RIDES_KEY = ["admin", "rides-management"] as const;

export function useAdminRides() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ADMIN_RIDES_KEY,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    queryFn: async (): Promise<AdminRideItem[]> => {
      const [{ data: rides, error: e1 }, { data: requests, error: e2 }] = await Promise.all([
        supabase
          .from("rides")
          .select("*")
          .eq("is_block", false)
          .order("scheduled_at", { ascending: false })
          .limit(300),
        supabase.from("ride_requests").select("*").order("created_at", { ascending: false }).limit(300),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const rideRows = rides ?? [];
      const requestRows = requests ?? [];
      // Une demande transformée en course est représentée par la course.
      const coveredRequestIds = new Set(rideRows.map((r) => r.request_id).filter(Boolean) as string[]);

      const ids = new Set<string>();
      for (const r of rideRows) {
        if (r.client_id) ids.add(r.client_id);
        if (r.driver_id) ids.add(r.driver_id);
      }
      for (const r of requestRows) {
        ids.add(r.client_id);
        ids.add(r.driver_id);
      }
      const names = new Map<string, string>();
      if (ids.size) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", [...ids]);
        for (const p of profiles ?? []) names.set(p.id, p.full_name);
      }

      const requestById = new Map(requestRows.map((r) => [r.id, r]));

      const items: AdminRideItem[] = [];

      for (const r of rideRows) {
        const req = r.request_id ? requestById.get(r.request_id) : undefined;
        items.push({
          kind: "ride",
          id: r.id,
          rideId: r.id,
          requestId: r.request_id ?? null,
          status: r.status,
          isImmediate: req?.is_immediate ?? false,
          createdAt: r.created_at,
          scheduledAt: r.scheduled_at,
          responseDeadline: null,
          startedAt: r.started_at,
          completedAt: r.completed_at,
          cancelledAt: r.cancelled_at,
          cancelledByRole: (r as { cancelled_by_role?: string | null }).cancelled_by_role ?? null,
          cancellationReason: r.cancellation_reason,
          clientId: r.client_id,
          driverId: r.driver_id,
          clientName: (r.client_id ? names.get(r.client_id) : null) ?? r.client_label ?? "Client",
          driverName: (r.driver_id ? names.get(r.driver_id) : null) ?? "Chauffeur",
          pickup: r.pickup_address,
          dropoff: r.dropoff_address,
          price: r.amount_ttc != null ? Number(r.amount_ttc) : r.price != null ? Number(r.price) : null,
          source: req ? "Demande client" : "Course créée par le chauffeur",
        });
      }

      for (const r of requestRows) {
        if (coveredRequestIds.has(r.id)) continue;
        items.push({
          kind: "request",
          id: r.id,
          rideId: null,
          requestId: r.id,
          status: r.status,
          isImmediate: r.is_immediate,
          createdAt: r.created_at,
          scheduledAt: r.scheduled_at,
          responseDeadline: r.response_deadline,
          startedAt: null,
          completedAt: null,
          cancelledAt: (r as { cancelled_at?: string | null }).cancelled_at ?? null,
          cancelledByRole: (r as { cancelled_by_role?: string | null }).cancelled_by_role ?? null,
          cancellationReason: (r as { cancellation_reason?: string | null }).cancellation_reason ?? null,
          clientId: r.client_id,
          driverId: r.driver_id,
          clientName: names.get(r.client_id) ?? "Client",
          driverName: names.get(r.driver_id) ?? "Chauffeur",
          pickup: r.pickup_address,
          dropoff: r.dropoff_address,
          price:
            r.amount_ttc != null
              ? Number(r.amount_ttc)
              : r.proposed_price != null
                ? Number(r.proposed_price)
                : null,
          source: r.is_immediate ? "Demande immédiate" : "Demande planifiée",
        });
      }

      return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
  });

  // Temps réel : toute évolution d'une course ou d'une demande rafraîchit la liste.
  useEffect(() => {
    const channel = supabase
      .channel(`admin-rides-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        void qc.invalidateQueries({ queryKey: ADMIN_RIDES_KEY });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_requests" }, () => {
        void qc.invalidateQueries({ queryKey: ADMIN_RIDES_KEY });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
}

/** Annulation administrative réelle (fonction serveur sécurisée, rôle admin vérifié côté base). */
export async function adminCancelRide(id: string, reason: string, comment: string | null) {
  const { data, error } = await supabase.rpc("admin_cancel_ride", {
    _ride: id,
    _reason: reason,
    _admin_comment: comment,
  });
  if (error) throw new Error(error.message);
  return data as { kind: string; id: string; status: string; already: boolean };
}
