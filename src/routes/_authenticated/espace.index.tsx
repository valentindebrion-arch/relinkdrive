import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatCard, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, formatDateTime } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/espace/")({
  component: ClientHome,
});

function ClientHome() {
  const { user, profile } = useAuth();

  const data = useQuery({
    queryKey: ["client-home", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [{ data: conns }, { data: requests }, { data: rides }] = await Promise.all([
        supabase.from("driver_client_connections").select("id").eq("client_id", user!.id),
        supabase.from("ride_requests").select("*").eq("client_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("rides").select("*").eq("client_id", user!.id).order("scheduled_at", { ascending: false }),
      ]);
      return { conns: conns ?? [], requests: requests ?? [], rides: rides ?? [] };
    },
  });

  const upcoming = (data.data?.rides ?? []).filter(
    (r) => new Date(r.scheduled_at) >= new Date() && !["cancelled", "completed"].includes(r.status),
  );
  const pending = (data.data?.requests ?? []).filter(
    (r) => !["confirmed", "refused", "cancelled", "completed"].includes(r.status),
  );

  return (
    <>
      <PageHeader
        title={`Bonjour ${profile?.full_name?.split(" ")[0] ?? ""}`}
        description="Vos chauffeurs de confiance, en un endroit."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Mes chauffeurs" value={data.data?.conns.length ?? 0} />
        <StatCard label="Demandes en cours" value={pending.length} />
        <StatCard label="Courses à venir" value={upcoming.length} />
      </div>

      <div className="surface mt-6 p-5">
        <h2 className="mb-3 font-semibold">Prochaines courses</h2>
        {upcoming.length === 0 ? (
          <EmptyState
            title="Aucune course prévue"
            description="Ajoutez un chauffeur via son QR code puis envoyez-lui une demande."
            action={
              <Link to="/espace/chauffeurs" className="mt-2 text-sm font-medium text-primary">
                Voir mes chauffeurs →
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium">
                    {r.pickup_address} → {r.dropoff_address}
                  </p>
                  <p className="text-muted-foreground">{formatDateTime(r.scheduled_at)}</p>
                </div>
                <StatusBadge status={r.status} labels={RIDE_STATUS_LABELS} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
