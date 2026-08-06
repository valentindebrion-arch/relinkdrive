import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, formatDateTime, formatEuro } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/admin/courses")({
  component: AdminRides,
});

function AdminRides() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "rides"],
    queryFn: async () => {
      const [{ data: rides, error }, { data: requests }] = await Promise.all([
        supabase.from("rides").select("*").order("scheduled_at", { ascending: false }).limit(100),
        supabase.from("ride_requests").select("*").order("created_at", { ascending: false }).limit(100),
      ]);
      if (error) throw error;
      return { rides: rides ?? [], requests: requests ?? [] };
    },
  });

  return (
    <div>
      <PageHeader title="Courses & demandes" description="Vue de supervision sur l'activité de la plateforme." />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Demandes récentes</h2>
            {!data?.requests.length ? (
              <EmptyState title="Aucune demande" />
            ) : (
              <div className="space-y-2">
                {data.requests.map((r) => (
                  <div key={r.id} className="surface flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="text-sm">
                      <p className="font-medium">
                        {r.pickup_address} → {r.dropoff_address}
                      </p>
                      <p className="text-muted-foreground">{formatDateTime(r.scheduled_at)} · {r.passengers} passager(s)</p>
                    </div>
                    <StatusBadge status={r.status} labels={RIDE_STATUS_LABELS} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Courses</h2>
            {!data?.rides.length ? (
              <EmptyState title="Aucune course" />
            ) : (
              <div className="space-y-2">
                {data.rides.map((r) => (
                  <div key={r.id} className="surface flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="text-sm">
                      <p className="font-medium">
                        {r.pickup_address} → {r.dropoff_address}
                      </p>
                      <p className="text-muted-foreground">
                        {formatDateTime(r.scheduled_at)} · {formatEuro(r.price)}
                      </p>
                    </div>
                    <StatusBadge status={r.status} labels={RIDE_STATUS_LABELS} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
