import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, INVOICE_LABELS, formatDateTime, formatEuro } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/espace/courses")({
  component: ClientRides,
});

function ClientRides() {
  const { user } = useAuth();

  const data = useQuery({
    queryKey: ["client-rides", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [{ data: rides }, { data: invoices }] = await Promise.all([
        supabase.from("rides").select("*").eq("client_id", user!.id).order("scheduled_at", { ascending: false }),
        supabase.from("invoices").select("*").eq("client_id", user!.id),
      ]);
      return { rides: rides ?? [], invoices: invoices ?? [] };
    },
  });

  const rides = data.data?.rides ?? [];

  return (
    <>
      <PageHeader title="Mes courses" description="Historique et suivi de vos trajets." />
      {rides.length === 0 ? (
        <EmptyState title="Aucune course" description="Vos courses confirmées apparaîtront ici." />
      ) : (
        <div className="space-y-3">
          {rides.map((r) => {
            const invoice = (data.data?.invoices ?? []).find((i) => i.ride_id === r.id);
            return (
              <Link
                key={r.id}
                to="/espace/courses/$rideId"
                params={{ rideId: r.id }}
                className="surface flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <div>
                  <p className="font-medium">
                    {r.pickup_address} → {r.dropoff_address}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(r.scheduled_at)}
                    {r.price ? ` · ${formatEuro(Number(r.price))}` : ""}
                  </p>
                  {invoice ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Facture {invoice.number} —{" "}
                      <StatusBadge status={invoice.status} labels={INVOICE_LABELS} />
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={r.status} labels={RIDE_STATUS_LABELS} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
