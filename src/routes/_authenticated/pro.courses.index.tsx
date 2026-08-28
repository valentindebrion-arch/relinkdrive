import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, INVOICE_LABELS, formatDateTime, formatEuro } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { DriverRequests } from "@/components/pro/DriverRequests";
import { ActiveRidePanel } from "@/components/ActiveRidePanel";
import { useNewRequestsCount } from "@/lib/driver-queries";

export const Route = createFileRoute("/_authenticated/pro/courses/")({
  validateSearch: (search: Record<string, unknown>): { demande?: string } =>
    typeof search["demande"] === "string" ? { demande: search["demande"] as string } : {},
  head: () => ({
    meta: [
      { title: "Mes courses — Relink Chauffeur" },
      {
        name: "description",
        content:
          "Pilotez votre activité Relink en temps réel : demandes en attente, course en cours et courses terminées aujourd'hui.",
      },
      { property: "og:title", content: "Mes courses — Relink Chauffeur" },
      { property: "og:description", content: "Demandes, course en cours et courses terminées du jour." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriverRidesPage,
});

function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <h2 className="mb-2 text-base font-semibold">
      {title}
      {count != null ? <span className="text-muted-foreground"> ({count})</span> : null}
    </h2>
  );
}

function DriverRidesPage() {
  const newRequests = useNewRequestsCount();

  return (
    <div className="space-y-6 overflow-x-hidden pb-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">Mes courses</h1>
          <p className="truncate text-sm text-muted-foreground">Gérez votre activité en temps réel.</p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 gap-1.5">
          <Link to="/pro/planning">
            <CalendarDays className="size-4" />
            Planning
          </Link>
        </Button>
      </header>

      <section>
        <SectionTitle title="Demandes de courses" count={newRequests.data ?? 0} />
        <DriverRequests />
      </section>

      <section>
        <SectionTitle title="Course en cours" />
        <ActiveRidePanel showEmpty className="mb-0" />
      </section>

      <CompletedToday />
    </div>
  );
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function CompletedToday() {
  const { user } = useAuth();
  const [showAll, setShowAll] = useState(false);

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
      const list = data ?? [];
      // Nom réel du client (même source que la Home et le planning).
      const ids = Array.from(new Set(list.map((r: any) => r.client_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: clients } = await supabase.rpc("get_connected_profiles", { _ids: ids });
        const names = new Map<string, string>();
        ((clients ?? []) as any[]).forEach((c) => {
          const n = (c.full_name ?? "").trim();
          if (n) names.set(c.id, n);
        });
        return list.map((r: any) => ({
          ...r,
          client_label: (r.client_id ? names.get(r.client_id) : null) ?? (r.client_label?.trim() || null),
        }));
      }
      return list;
    },
  });

  const invoices = useQuery({
    queryKey: ["driver-invoices", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").eq("driver_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const all = rides.data ?? [];
  const history = all
    .filter((r) => ["completed", "cancelled", "refused"].includes(r.status))
    .sort(
      (a, b) =>
        new Date(b.completed_at ?? b.scheduled_at).getTime() - new Date(a.completed_at ?? a.scheduled_at).getTime(),
    );
  const today = history.filter(
    (r) => r.status === "completed" && new Date(r.completed_at ?? r.scheduled_at).getTime() >= startOfToday(),
  );
  const list = showAll ? history : today;

  return (
    <section>
      <SectionTitle title={showAll ? "Historique complet" : "Courses terminées aujourd'hui"} count={list.length} />
      {list.length === 0 ? (
        <EmptyState title="Aucune course terminée aujourd'hui" description="Vos courses du jour s'afficheront ici." />
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const inv = (invoices.data ?? []).find((i) => i.ride_id === r.id);
            return (
              <Link
                key={r.id}
                to="/pro/courses/$rideId"
                params={{ rideId: r.id }}
                className="surface tap-active block p-4 transition-colors hover:border-primary/40"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(r.completed_at ?? r.scheduled_at)} · {r.client_label ?? "Client"}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium">
                      {r.pickup_address} → {r.dropoff_address}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-primary">
                    {r.price ? formatEuro(Number(r.price)) : "—"}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {inv ? (
                    <StatusBadge status={inv.status} labels={INVOICE_LABELS} />
                  ) : (
                    <StatusBadge status={r.status} labels={RIDE_STATUS_LABELS} />
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    Détail <ChevronRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <Button variant="outline" className="mt-3 w-full" onClick={() => setShowAll((v) => !v)}>
        {showAll ? "Revenir aux courses du jour" : "Voir tout l'historique"}
      </Button>
    </section>
  );
}
