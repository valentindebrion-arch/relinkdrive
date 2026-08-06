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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DriverRequests } from "@/components/pro/DriverRequests";
import { Planning } from "@/components/pro/Planning";
import { useNewRequestsCount } from "@/lib/driver-queries";

export const Route = createFileRoute("/_authenticated/pro/courses")({
  component: DriverRidesPage,
});

const IN_PROGRESS = ["driver_enroute", "driver_arrived", "client_onboard", "in_progress"];

function DriverRidesPage() {
  const [tab, setTab] = useState("demandes");
  const newRequests = useNewRequestsCount();

  return (
    <>
      <PageHeader title="Mes courses" description="Demandes, planning et suivi de vos courses au même endroit." />
      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-4 mb-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="demandes" className="gap-1.5">
              Demandes
              {newRequests.data ? (
                <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {newRequests.data}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="planning">Planning</TabsTrigger>
            <TabsTrigger value="avenir">À venir</TabsTrigger>
            <TabsTrigger value="encours">En cours</TabsTrigger>
            <TabsTrigger value="historique">Historique</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="demandes">
          <DriverRequests />
        </TabsContent>
        <TabsContent value="planning">
          <Planning />
        </TabsContent>
        <TabsContent value="avenir">
          <RideList filter="upcoming" />
        </TabsContent>
        <TabsContent value="encours">
          <RideList filter="active" />
        </TabsContent>
        <TabsContent value="historique">
          <RideList filter="history" />
        </TabsContent>
      </Tabs>
    </>
  );
}

function RideList({ filter }: { filter: "upcoming" | "active" | "history" }) {
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

  async function cancel(rideId: string, clientId: string | null) {
    const { error } = await supabase.from("rides").update({ status: "cancelled" as never }).eq("id", rideId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase
      .from("ride_status_history")
      .insert({ ride_id: rideId, status: "cancelled" as never, changed_by: user!.id });
    toast.success("Course annulée");
    void qc.invalidateQueries({ queryKey: ["driver-rides"] });
    void qc.invalidateQueries({ queryKey: ["driver-data"] });
  }

  const all = rides.data ?? [];
  const list = all.filter((r) => {
    if (filter === "active") return IN_PROGRESS.includes(r.status);
    if (filter === "upcoming") return r.status === "confirmed";
    return ["completed", "cancelled", "refused"].includes(r.status);
  });

  if (!list.length) {
    return (
      <EmptyState
        title="Aucune course"
        description={
          filter === "history"
            ? "Vos courses terminées et annulées s'afficheront ici."
            : "Les demandes acceptées apparaîtront ici."
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {list.map((r) => (
        <div key={r.id} className="surface grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3 sm:p-4">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {r.pickup_address} → {r.dropoff_address}
            </p>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {formatDateTime(r.scheduled_at)} · {r.price ? formatEuro(Number(r.price)) : "Prix à définir"}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusBadge status={r.status} labels={RIDE_STATUS_LABELS} />
            {["confirmed", "driver_enroute"].includes(r.status) ? (
              <Button size="sm" variant="destructive" onClick={() => cancel(r.id, r.client_id)}>
                Annuler
              </Button>
            ) : null}
          </div>
        </div>
      ))}
      {filter === "active" ? (
        <p className="text-xs text-muted-foreground">
          L'avancement des étapes se pilote depuis le bloc « Course en cours » de l'accueil.
        </p>
      ) : null}
    </div>
  );
}
