import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchConnectedProfile, fetchConnectedProfiles } from "@/lib/connected-profiles";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, formatDateTime, formatEuro } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/espace/courses/demandes")({
  head: () => ({
    meta: [
      { title: "Mes demandes — Relink" },
      {
        name: "description",
        content:
          "Suivez les demandes de course envoyées à vos chauffeurs Relink : statut, tarif proposé et horaire confirmé.",
      },
      { property: "og:title", content: "Mes demandes — Relink" },
      { property: "og:description", content: "Statut des demandes de course envoyées à vos chauffeurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientRequests,
});

function ClientRequests() {
  const { user } = useAuth();

  const data = useQuery({
    queryKey: ["client-requests", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: requests, error } = await supabase
        .from("ride_requests")
        .select("*")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const driverIds = [...new Set((requests ?? []).map((r) => r.driver_id))];
      const names: Record<string, string> = {};
      if (driverIds.length) {
        const profiles = await fetchConnectedProfiles(driverIds);
        (profiles ?? []).forEach((p) => {
          names[p.id] = p.full_name || "Chauffeur";
        });
      }
      return { list: requests ?? [], names };
    },
  });

  const list = data.data?.list ?? [];

  return (
    <div className="overflow-x-hidden">
      <Link
        to="/espace/courses"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Mes courses
      </Link>
      <PageHeader title="Mes demandes" description="Les demandes de course envoyées à vos chauffeurs." />
      {list.length === 0 ? (
        <EmptyState
          title="Aucune demande"
          description="Vos demandes de trajet apparaîtront ici en attendant la confirmation du chauffeur."
        />
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <div key={r.id} className="surface grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 p-4">
              <div className="min-w-0">
                <p className="font-medium break-words">
                  {r.pickup_address} → {r.dropoff_address}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(r.proposed_time ?? r.scheduled_at)} ·{" "}
                  {data.data?.names[r.driver_id] ?? "Chauffeur"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.passengers} passager(s) · {r.luggage} bagage(s)
                  {r.round_trip ? " · aller-retour" : ""}
                </p>
                {r.proposed_price ? (
                  <p className="mt-1 text-sm font-semibold">Prix proposé : {formatEuro(Number(r.proposed_price))}</p>
                ) : null}
                {r.driver_message ? (
                  <p className="mt-1 text-xs text-muted-foreground">« {r.driver_message} »</p>
                ) : null}
              </div>
              <StatusBadge status={r.status} labels={RIDE_STATUS_LABELS} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
