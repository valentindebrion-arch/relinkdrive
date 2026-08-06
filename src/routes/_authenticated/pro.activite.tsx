import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatCard } from "@/components/Ui";
import { formatEuro } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/pro/activite")({
  component: ActivityPage,
});

function ActivityPage() {
  const { user } = useAuth();

  const data = useQuery({
    queryKey: ["pro-activity", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [{ data: rides }, { data: invoices }, { data: requests }] = await Promise.all([
        supabase.from("rides").select("*").eq("driver_id", user!.id).eq("is_block", false),
        supabase.from("invoices").select("*").eq("driver_id", user!.id),
        supabase.from("ride_requests").select("status, created_at").eq("driver_id", user!.id),
      ]);
      return { rides: rides ?? [], invoices: invoices ?? [], requests: requests ?? [] };
    },
  });

  const rides = data.data?.rides ?? [];
  const invoices = data.data?.invoices ?? [];
  const requests = data.data?.requests ?? [];
  const completed = rides.filter((r) => r.status === "completed");
  const revenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount_ttc), 0);
  const accepted = requests.filter((r) => !["refused", "cancelled"].includes(r.status)).length;
  const rate = requests.length ? Math.round((accepted / requests.length) * 100) : 0;
  const avg = completed.length ? revenue / completed.length : 0;

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    const label = d.toLocaleDateString("fr-FR", { month: "short" });
    const total = invoices
      .filter((inv) => {
        const dd = new Date(inv.issued_on);
        return dd.getMonth() === d.getMonth() && dd.getFullYear() === d.getFullYear() && inv.status !== "cancelled";
      })
      .reduce((s, inv) => s + Number(inv.amount_ttc), 0);
    return { label, total };
  });
  const max = Math.max(1, ...months.map((m) => m.total));

  return (
    <>
      <PageHeader title="Mon activité" description="Vos statistiques personnelles." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Courses réalisées" value={completed.length} />
        <StatCard label="Chiffre d'affaires encaissé" value={formatEuro(revenue)} />
        <StatCard label="Panier moyen" value={formatEuro(avg)} />
        <StatCard label="Taux d'acceptation" value={`${rate}%`} />
      </div>

      <div className="surface mt-6 p-5">
        <h2 className="mb-4 font-semibold">Revenus des 6 derniers mois</h2>
        <div className="flex h-48 items-end gap-3">
          {months.map((m) => (
            <div key={m.label} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-md bg-primary/80"
                style={{ height: `${(m.total / max) * 100}%`, minHeight: "4px" }}
              />
              <span className="text-xs text-muted-foreground">{m.label}</span>
              <span className="text-xs font-medium">{formatEuro(m.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
