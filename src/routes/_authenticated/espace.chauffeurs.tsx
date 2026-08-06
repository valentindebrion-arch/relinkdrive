import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/Ui";
import { formatDateTime } from "@/lib/labels";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/espace/chauffeurs")({
  component: ClientDrivers,
});

function ClientDrivers() {
  const { user } = useAuth();

  const drivers = useQuery({
    queryKey: ["client-drivers", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: conns } = await supabase
        .from("driver_client_connections")
        .select("*")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });
      const ids = (conns ?? []).map((c) => c.driver_id);
      if (!ids.length) return [];
      const [{ data: profiles }, { data: dprofiles }, { data: vehicles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, phone").in("id", ids),
        supabase.from("driver_profiles").select("user_id, business_name, city, slug, languages, services").in("user_id", ids),
        supabase.from("vehicles").select("driver_id, brand, model, max_passengers").in("driver_id", ids),
      ]);
      return (conns ?? []).map((c) => ({
        ...c,
        profile: (profiles ?? []).find((p) => p.id === c.driver_id),
        driver: (dprofiles ?? []).find((d) => d.user_id === c.driver_id),
        vehicle: (vehicles ?? []).find((v) => v.driver_id === c.driver_id),
      }));
    },
  });

  const list = drivers.data ?? [];

  return (
    <>
      <PageHeader title="Mes chauffeurs" description="Les chauffeurs que vous avez ajoutés à votre carnet." />
      {list.length === 0 ? (
        <EmptyState
          title="Aucun chauffeur"
          description="Scannez le QR code de votre chauffeur en fin de course pour l'ajouter ici."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((d) => (
            <div key={d.id} className="surface p-5">
              <p className="font-medium">{d.profile?.full_name ?? "Chauffeur"}</p>
              <p className="text-sm text-muted-foreground">
                {d.driver?.business_name ?? "Chauffeur VTC"}
                {d.driver?.city ? ` · ${d.driver.city}` : ""}
              </p>
              {d.vehicle ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {[d.vehicle.brand, d.vehicle.model].filter(Boolean).join(" ")} · {d.vehicle.max_passengers} places
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">Ajouté le {formatDateTime(d.created_at)}</p>
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm">
                  <Link to="/espace/demandes" search={{ driver: d.driver_id }}>
                    Demander un trajet
                  </Link>
                </Button>
                {d.driver?.slug ? (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/chauffeur/$slug" params={{ slug: d.driver.slug }}>
                      Voir la fiche
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
