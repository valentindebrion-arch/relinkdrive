import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Users, Car, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/Ui";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const { data } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => {
      const [pending, drivers, users, rides, reports] = await Promise.all([
        supabase.from("driver_profiles").select("user_id", { count: "exact", head: true }).eq("verification_status", "pending"),
        supabase.from("driver_profiles").select("user_id", { count: "exact", head: true }).eq("verification_status", "verified"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("rides").select("id", { count: "exact", head: true }),
        supabase.from("reports").select("id", { count: "exact", head: true }).in("status", ["new", "in_progress"]),
      ]);
      return {
        pending: pending.count ?? 0,
        drivers: drivers.count ?? 0,
        users: users.count ?? 0,
        rides: rides.count ?? 0,
        reports: reports.count ?? 0,
      };
    },
  });

  return (
    <div>
      <PageHeader title="Modération" description="Supervision du logiciel : dossiers chauffeurs, comptes et incidents." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Dossiers à vérifier" value={data?.pending ?? "—"} icon={<ShieldCheck />} />
        <StatCard label="Chauffeurs vérifiés" value={data?.drivers ?? "—"} icon={<Car />} />
        <StatCard label="Comptes" value={data?.users ?? "—"} icon={<Users />} />
        <StatCard label="Signalements ouverts" value={data?.reports ?? "—"} icon={<Flag />} />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link to="/admin/chauffeurs" className="surface p-5 transition-colors hover:bg-accent/40">
          <p className="font-medium">Gérer les chauffeurs</p>
          <p className="mt-1 text-sm text-muted-foreground">Comptes chauffeurs, validation des dossiers et abonnements Gratuit ou Pro.</p>
        </Link>
        <Link to="/admin/utilisateurs" className="surface p-5 transition-colors hover:bg-accent/40">
          <p className="font-medium">Gérer les utilisateurs</p>
          <p className="mt-1 text-sm text-muted-foreground">Modifier les statuts de compte, restreindre ou suspendre un accès.</p>
        </Link>
      </div>
    </div>
  );
}
