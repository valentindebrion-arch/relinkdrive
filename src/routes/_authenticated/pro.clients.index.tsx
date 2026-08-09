import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { CRM_LABELS, formatDate } from "@/lib/labels";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pro/clients/")({
  head: () => ({
    meta: [
      { title: "Mes clients — Relink Chauffeur" },
      { name: "description", content: "Retrouvez et gérez votre clientèle Relink : statuts, courses et notes privées." },
      { property: "og:title", content: "Mes clients — Relink Chauffeur" },
      { property: "og:description", content: "Votre carnet de clients Relink, filtrable et consultable en un clic." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriverClientsList,
});

export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function relativeDay(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return "hier";
  return `le ${formatDate(value)}`;
}

const FILTERS = [
  { id: "all", label: "Tous" },
  { id: "regular", label: "Réguliers" },
  { id: "new", label: "Nouveaux" },
  { id: "inactive", label: "Inactifs" },
  { id: "rides", label: "Plus de courses" },
  { id: "recent", label: "Dernière course" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function DriverClientsList() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filter, setFilter] = useState<FilterId>("all");

  const clients = useQuery({
    queryKey: ["driver-clients", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: conns, error } = await supabase
        .from("driver_client_connections")
        .select("*")
        .eq("driver_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (conns ?? []).map((c) => c.client_id);
      if (!ids.length) return [];
      const [{ data: profiles }, { data: rides }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, phone, email, avatar_url").in("id", ids),
        supabase.from("rides").select("client_id, scheduled_at, price, status").eq("driver_id", user!.id),
      ]);
      return (conns ?? []).map((c) => {
        const clientRides = (rides ?? []).filter((r) => r.client_id === c.client_id);
        const sorted = [...clientRides].sort((a, b) => (a.scheduled_at < b.scheduled_at ? 1 : -1));
        return {
          ...c,
          profile: (profiles ?? []).find((p) => p.id === c.client_id),
          ridesCount: clientRides.length,
          lastRide: sorted[0],
        };
      });
    },
  });

  const list = useMemo(() => {
    let rows = clients.data ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (c) =>
          (c.profile?.full_name ?? "").toLowerCase().includes(q) ||
          (c.profile?.phone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, "")),
      );
    }
    if (filter === "regular" || filter === "new" || filter === "inactive") {
      rows = rows.filter((c) => c.crm_status === filter);
    }
    if (filter === "rides") rows = [...rows].sort((a, b) => b.ridesCount - a.ridesCount);
    if (filter === "recent")
      rows = [...rows].sort(
        (a, b) =>
          new Date(b.lastRide?.scheduled_at ?? 0).getTime() - new Date(a.lastRide?.scheduled_at ?? 0).getTime(),
      );
    return rows;
  }, [clients.data, search, filter]);

  const total = clients.data?.length ?? 0;

  return (
    <div className="space-y-4 overflow-x-hidden pb-6">
      <header className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-xl font-bold sm:text-2xl">Mes clients</h1>
          {total > 0 ? (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {total} client{total > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
        <p className="truncate text-sm text-muted-foreground">Retrouvez et gérez votre clientèle.</p>
      </header>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un nom ou un numéro"
            className="h-11 pl-9"
            inputMode="search"
          />
        </div>
        <Button
          variant={showFilters || filter !== "all" ? "default" : "outline"}
          size="icon"
          className="size-11 shrink-0"
          aria-label="Filtres"
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal className="size-4" />
        </Button>
      </div>

      {showFilters ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "tap-active shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : null}

      {clients.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyState
          title="Votre carnet est encore vide."
          description="Partagez votre profil ou votre QR code pour permettre à vos passagers de vous retrouver sur ReLink."
          action={
            <Button asChild size="sm" className="mt-2">
              <Link to="/pro/qr">Partager mon QR code</Link>
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <EmptyState title="Aucun résultat" description="Aucun client ne correspond à votre recherche." />
      ) : (
        <div className="space-y-2.5">
          {list.map((c) => (
            <Link
              key={c.id}
              to="/pro/clients/$clientId"
              params={{ clientId: c.client_id }}
              className="surface tap-active flex items-center gap-3 p-3 transition-colors hover:border-primary/40"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {initials(c.profile?.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-semibold">{c.profile?.full_name ?? "Client"}</p>
                  <StatusBadge status={c.crm_status} labels={CRM_LABELS} className="shrink-0" />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {c.ridesCount} course{c.ridesCount > 1 ? "s" : ""}
                  {c.lastRide ? ` · Dernière course ${relativeDay(c.lastRide.scheduled_at)}` : ""}
                </p>
                {c.profile?.phone ? <p className="truncate text-xs text-muted-foreground">{c.profile.phone}</p> : null}
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
