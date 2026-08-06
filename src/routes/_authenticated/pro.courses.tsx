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


export const Route = createFileRoute("/_authenticated/pro/courses")({
  component: DriverRides,
});

const FLOW: Record<string, { next: string; label: string }> = {
  confirmed: { next: "driver_enroute", label: "Je pars" },
  driver_enroute: { next: "driver_arrived", label: "Je suis arrivé" },
  driver_arrived: { next: "client_onboard", label: "Client à bord" },
  client_onboard: { next: "in_progress", label: "Démarrer la course" },
  in_progress: { next: "completed", label: "Terminer la course" },
};

function DriverRides() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editTime, setEditTime] = useState("");

  function openEdit(r: { id: string; price: number | null; scheduled_at: string }) {
    if (editId === r.id) {
      setEditId(null);
      return;
    }
    setEditId(r.id);
    setEditPrice(r.price != null ? String(r.price) : "");
    const d = new Date(r.scheduled_at);
    const pad = (n: number) => String(n).padStart(2, "0");
    setEditTime(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
    );
  }

  async function saveEdit(rideId: string, clientId: string | null) {
    const { error } = await supabase
      .from("rides")
      .update({
        price: editPrice ? Number(editPrice) : null,
        ...(editTime ? { scheduled_at: new Date(editTime).toISOString() } : {}),
      })
      .eq("id", rideId);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (clientId) {
      await supabase.rpc("notify_counterparty", { _recipient: clientId, _kind: "ride_update" });
    }
    toast.success("Course mise à jour");
    setEditId(null);
    void qc.invalidateQueries({ queryKey: ["driver-rides"] });
  }


  const rides = useQuery({
    queryKey: ["driver-rides", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user!.id)
        .eq("is_block", false)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function advance(rideId: string, clientId: string | null, status: string) {
    const now = new Date().toISOString();
    const patch = {
      status: status as never,
      ...(status === "in_progress" ? { started_at: now } : {}),
      ...(status === "completed" ? { completed_at: now } : {}),
    };
    const { error } = await supabase.from("rides").update(patch).eq("id", rideId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("ride_status_history").insert({ ride_id: rideId, status: status as never, changed_by: user!.id });
    if (clientId) {
      await supabase.rpc("notify_counterparty", { _recipient: clientId, _kind: "ride_update" });
    }
    void qc.invalidateQueries({ queryKey: ["driver-rides"] });
  }

  async function createInvoice(ride: { id: string; client_id: string | null; price: number | null; pickup_address: string }) {
    const number = `F-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000 + 100000)}`;
    const ht = Number(ride.price ?? 0);
    const { error } = await supabase.from("invoices").insert({
      driver_id: user!.id,
      client_id: ride.client_id,
      ride_id: ride.id,
      number,
      amount_ht: ht,
      amount_ttc: ht,
      vat_rate: 0,
      description: `Course — ${ride.pickup_address}`,
      status: "draft",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Facture créée");
    void qc.invalidateQueries({ queryKey: ["driver-invoices"] });
  }

  const list = rides.data ?? [];

  return (
    <>
      <PageHeader title="Courses" description="Suivez le déroulement de vos courses." />
      {list.length === 0 ? (
        <EmptyState title="Aucune course" description="Les demandes acceptées apparaîtront ici." />
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const step = FLOW[r.status];
            return (
              <div key={r.id} className="surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {r.pickup_address} → {r.dropoff_address}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(r.scheduled_at)} · {r.price ? formatEuro(Number(r.price)) : "Prix à définir"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.status} labels={RIDE_STATUS_LABELS} />
                    {step ? (
                      <Button size="sm" onClick={() => advance(r.id, r.client_id, step.next)}>
                        {step.label}
                      </Button>
                    ) : null}
                    {!["completed", "cancelled"].includes(r.status) ? (
                      <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                        Modifier heure / prix
                      </Button>
                    ) : null}
                    {r.status === "completed" ? (
                      <Button size="sm" variant="outline" onClick={() => createInvoice(r)}>
                        Créer la facture
                      </Button>
                    ) : null}
                    {["confirmed", "driver_enroute"].includes(r.status) ? (
                      <Button size="sm" variant="destructive" onClick={() => advance(r.id, r.client_id, "cancelled")}>
                        Annuler
                      </Button>
                    ) : null}
                  </div>
                </div>

                {editId === r.id ? (
                  <div className="mt-4 grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-3">
                    <div>
                      <Label htmlFor={`rp-${r.id}`}>Prix (€)</Label>
                      <Input
                        id={`rp-${r.id}`}
                        type="number"
                        min="0"
                        step="0.5"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`rt-${r.id}`}>Date et heure</Label>
                      <Input
                        id={`rt-${r.id}`}
                        type="datetime-local"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button size="sm" onClick={() => saveEdit(r.id, r.client_id)}>
                        Enregistrer
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );

          })}
        </div>
      )}
    </>
  );
}
