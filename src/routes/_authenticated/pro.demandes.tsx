import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, formatDateTime, formatEuro } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/pro/demandes")({
  component: DriverRequests,
});

type Req = {
  id: string;
  client_id: string;
  driver_id: string;
  pickup_address: string;
  dropoff_address: string;
  scheduled_at: string;
  passengers: number;
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

function DriverRequests() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");

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
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone").in("id", clientIds);
        (profiles ?? []).forEach((p) => {
          names[p.id] = p.full_name || "Client";
        });
      }
      return { list: (data ?? []) as Req[], names };
    },
  });

  async function log(requestId: string, status: string) {
    await supabase.from("ride_status_history").insert({ request_id: requestId, status: status as never, changed_by: user!.id });
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
    await supabase.from("notifications").insert({
      user_id: r.client_id,
      title: `Demande ${RIDE_STATUS_LABELS[status]?.toLowerCase()}`,
      body: `${r.pickup_address} → ${r.dropoff_address}`,
      kind: "request",
      link: "/espace/demandes",
    });
    toast.success("Demande mise à jour");
    setOpenId(null);
    void qc.invalidateQueries({ queryKey: ["driver-requests"] });
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
  }

  const list = requests.data?.list ?? [];

  return (
    <>
      <PageHeader title="Demandes" description="Traitez les demandes envoyées par vos clients." />
      {list.length === 0 ? (
        <EmptyState title="Aucune demande" description="Vos clients pourront vous envoyer une demande après vous avoir ajouté." />
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <div key={r.id} className="surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {r.pickup_address} → {r.dropoff_address}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(r.scheduled_at)} · {requests.data?.names[r.client_id] ?? "Client"} ·{" "}
                    {r.passengers} passager(s) · {r.luggage} bagage(s)
                    {r.round_trip ? " · aller-retour" : ""}
                  </p>
                  {r.comment ? <p className="mt-1 text-sm text-muted-foreground">« {r.comment} »</p> : null}
                  {r.special_needs ? <p className="text-sm text-muted-foreground">Besoins : {r.special_needs}</p> : null}
                  {r.proposed_price ? (
                    <p className="mt-1 text-sm">
                      Proposition envoyée : {formatEuro(Number(r.proposed_price))}
                      {r.proposed_time ? ` — ${formatDateTime(r.proposed_time)}` : ""}
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={r.status} labels={RIDE_STATUS_LABELS} />
              </div>

              {["new", "reviewing", "proposal_sent", "awaiting_client"].includes(r.status) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => confirmRide(r)}>
                    Accepter et confirmer
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                    Proposer horaire / prix
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(r, "reviewing")}>
                    À étudier
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setStatus(r, "refused")}>
                    Refuser
                  </Button>
                </div>
              ) : null}

              {openId === r.id ? (
                <div className="mt-4 grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor={`p-${r.id}`}>Prix proposé (€)</Label>
                    <Input id={`p-${r.id}`} type="number" min="0" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor={`t-${r.id}`}>Horaire proposé</Label>
                    <Input id={`t-${r.id}`} type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
                  </div>
                  <div className="sm:col-span-3">
                    <Label htmlFor={`m-${r.id}`}>Message</Label>
                    <Textarea id={`m-${r.id}`} value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} />
                  </div>
                  <div className="sm:col-span-3">
                    <Button
                      size="sm"
                      onClick={() =>
                        setStatus(r, "proposal_sent", {
                          proposed_price: price ? Number(price) : null,
                          proposed_time: time ? new Date(time).toISOString() : null,
                          driver_message: message || null,
                        })
                      }
                    >
                      Envoyer la proposition
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
