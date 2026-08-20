import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calendar, MapPin, Navigation, ShieldCheck, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchConnectedProfile, fetchConnectedProfiles } from "@/lib/connected-profiles";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, formatDateTime, formatEuro } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { checkDriverAvailability } from "@/lib/availability.functions";
import { SAFETY_MARGIN_MIN, availabilityMessage } from "@/lib/availability";

const PENDING = ["new", "reviewing", "proposal_sent", "awaiting_client"];

/** Faisabilité du créneau vue chauffeur : jamais d'info sur les autres clients. */
function FeasibilityNote({
  driverId,
  pickup,
  dropoff,
  scheduledAt,
}: {
  driverId: string;
  pickup: string;
  dropoff: string;
  scheduledAt: string;
}) {
  const check = useServerFn(checkDriverAvailability);
  const q = useQuery({
    queryKey: ["request-feasibility", driverId, pickup, dropoff, scheduledAt],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await check({
        data: {
          driverIds: [driverId],
          pickup,
          dropoff,
          desiredIso: new Date(scheduledAt).toISOString(),
        },
      });
      return res.results[0] ?? null;
    },
  });
  if (q.isLoading)
    return <p className="mt-2 text-xs text-muted-foreground">Vérification du créneau…</p>;
  const r = q.data;
  if (!r) return null;
  const ok = r.status === "available";
  return (
    <p
      className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium ${
        ok ? "bg-primary/10 text-primary" : "bg-warning/10 text-foreground"
      }`}
    >
      <ShieldCheck className="size-3.5 shrink-0" />
      {ok ? "Créneau vérifié par ReLink" : availabilityMessage(r)}
      {r.repositionMin !== null ? (
        <span>· Repositionnement estimé : {r.repositionMin} min</span>
      ) : null}
      <span>· Marge prévue : {SAFETY_MARGIN_MIN} min</span>
    </p>
  );
}

type Req = {
  id: string;
  client_id: string;
  driver_id: string;
  pickup_address: string;
  dropoff_address: string;
  scheduled_at: string;
  created_at: string;
  passengers: number;
  payment_method: string | null;
  luggage: number;
  round_trip: boolean;
  trip_type: string | null;
  special_needs: string | null;
  comment: string | null;
  preferred_contact: string | null;
  status: string;
  proposed_price: number | null;
  proposed_time: string | null;
  driver_message: string | null;
};

/** Presentation helper: the client form appends "… · X km · ~Y min" to the comment. */
function readEstimate(comment: string | null) {
  if (!comment) return null;
  const km = comment.match(/([\d.,]+)\s*km/);
  const min = comment.match(/~\s*([\d.,]+)\s*min/);
  if (!km && !min) return null;
  return [
    km ? `${km[1]} km` : null,
    min ? `~${Math.round(Number(min[1]!.replace(",", ".")))} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function isFlash(r: Req) {
  const delta = new Date(r.scheduled_at).getTime() - new Date(r.created_at).getTime();
  return delta <= 20 * 60 * 1000;
}

function cleanComment(comment: string | null) {
  if (!comment) return null;
  const text = comment
    .split("\n")
    .filter((l) => !l.startsWith("Prix final Relink"))
    .join(" ")
    .trim();
  return text || null;
}

export function DriverRequests() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const requests = useQuery({
    queryKey: ["driver-requests", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ride_requests")
        .select("*")
        .eq("driver_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const clientIds = [...new Set((data ?? []).map((r) => r.client_id))];
      const names: Record<string, string> = {};
      if (clientIds.length) {
        const profiles = await fetchConnectedProfiles(clientIds);
        (profiles ?? []).forEach((p) => {
          names[p.id] = p.full_name || "Client";
        });
      }
      return { list: (data ?? []) as Req[], names };
    },
  });

  async function log(requestId: string, status: string) {
    await supabase
      .from("ride_status_history")
      .insert({ request_id: requestId, status: status as never, changed_by: user!.id });
  }

  async function setStatus(r: Req, status: string, extra: Record<string, unknown> = {}) {
    const { error } = await supabase
      .from("ride_requests")
      .update({ status: status as never, ...extra })
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await log(r.id, status);
    toast.success("Demande mise à jour");

    void qc.invalidateQueries({ queryKey: ["driver-requests"] });
    void qc.invalidateQueries({ queryKey: ["driver-board"] });
  }

  async function confirmRide(r: Req) {
    const { error } = await supabase.from("rides").insert({
      request_id: r.id,
      client_id: r.client_id,
      driver_id: r.driver_id,
      pickup_address: r.pickup_address,
      dropoff_address: r.dropoff_address,
      scheduled_at: r.proposed_time ?? r.scheduled_at,
      price: r.proposed_price,
      passengers: r.passengers,
      payment_method: r.payment_method ?? null,
      status: "confirmed",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await setStatus(r, "confirmed");
    await supabase
      .from("driver_client_connections")
      .update({ crm_status: "active" as never })
      .eq("driver_id", r.driver_id)
      .eq("client_id", r.client_id);
    void qc.invalidateQueries({ queryKey: ["driver-rides"] });
    void qc.invalidateQueries({ queryKey: ["driver-active-ride"] });
    void qc.invalidateQueries({ queryKey: ["driver-board"] });
    void qc.invalidateQueries({ queryKey: ["planning"] });
    void qc.invalidateQueries({ queryKey: ["pro-overview"] });
    void qc.invalidateQueries({ queryKey: ["request-feasibility"] });
  }

  const list = (requests.data?.list ?? []).filter((r) => PENDING.includes(r.status));

  if (list.length === 0) {
    return (
      <EmptyState
        title="Aucune demande en attente"
        description="Vos clients pourront vous envoyer une demande après vous avoir ajouté."
      />
    );
  }

  return (
    <div className="space-y-3">
      {list.map((r) => {
        const estimate = readEstimate(r.comment);
        const note = cleanComment(r.comment);
        const flash = isFlash(r);
        return (
          <article key={r.id} className="surface p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <div className="min-w-0">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    flash
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {flash ? <Zap className="size-3" /> : <Calendar className="size-3" />}
                  {flash ? "Flash" : "Planifiée"}
                </span>
                <p className="mt-1.5 truncate text-sm font-semibold">
                  {requests.data?.names[r.client_id] ?? "Client"}
                </p>
              </div>
              <StatusBadge status={r.status} labels={RIDE_STATUS_LABELS} />
            </div>

            <div className="mt-3 space-y-1.5 text-sm">
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="break-words">{r.pickup_address}</span>
              </p>
              <p className="flex items-start gap-2">
                <Navigation className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="break-words">{r.dropoff_address}</span>
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{formatDateTime(r.scheduled_at)}</span>
              {estimate ? <span>{estimate}</span> : null}
              <span>
                {r.passengers} pass. · {r.luggage} bag.
                {r.payment_method ? ` · Règlement : ${paymentMethodLabel(r.payment_method)}` : ""}
                {r.round_trip ? " · A/R" : ""}
              </span>
              {r.trip_type ? <span>{r.trip_type}</span> : null}
            </div>

            {note ? (
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">« {note} »</p>
            ) : null}
            {r.special_needs ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                Besoins : {r.special_needs}
              </p>
            ) : null}

            <FeasibilityNote
              driverId={r.driver_id}
              pickup={r.pickup_address}
              dropoff={r.dropoff_address}
              scheduledAt={r.proposed_time ?? r.scheduled_at}
            />

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-base font-bold text-primary">
                {r.proposed_price ? formatEuro(Number(r.proposed_price)) : "Prix à définir"}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={() => setStatus(r, "refused")}>
                  Refuser
                </Button>
                <Button size="sm" onClick={() => confirmRide(r)}>
                  Accepter
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
