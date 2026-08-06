import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, formatDateTime, formatEuro } from "@/lib/labels";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/pro/courses")({
  component: DriverRides,
});

function DriverRides() {
  const { user } = useAuth();
  const qc = useQueryClient();



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
            return (
              <div key={r.id} className="surface flex flex-wrap items-center justify-between gap-3 p-4">
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
            );


          })}
        </div>
      )}
    </>
  );
}
