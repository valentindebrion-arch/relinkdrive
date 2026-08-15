import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search, Eye, Ban, Clock, AlertTriangle } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, formatDateTime, formatEuro } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminCancelRideDialog } from "@/components/admin/AdminCancelRideDialog";
import {
  ADMIN_RIDES_KEY,
  type AdminRideItem,
  elapsedSince,
  isActive,
  isPlanned,
  useAdminRides,
} from "@/lib/admin-rides";

export const Route = createFileRoute("/_authenticated/admin/courses/")({
  head: () => ({
    meta: [
      { title: "Courses actives — Administration Relink" },
      {
        name: "description",
        content:
          "Supervision des courses et demandes Relink : suivi des courses actives, filtres, détail et annulation administrative synchronisée.",
      },
      { property: "og:title", content: "Courses actives — Administration Relink" },
      { property: "og:description", content: "Supervision et annulation administrative des courses Relink." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminRides,
});

type TabKey = "active" | "planned" | "completed" | "cancelled" | "all";

const TABS: { key: TabKey; label: string }[] = [
  { key: "active", label: "En cours" },
  { key: "planned", label: "Planifiées" },
  { key: "completed", label: "Terminées" },
  { key: "cancelled", label: "Annulées" },
  { key: "all", label: "Toutes" },
];

function inTab(item: AdminRideItem, tab: TabKey) {
  switch (tab) {
    case "active":
      return isActive(item) && !isPlanned(item);
    case "planned":
      return isPlanned(item);
    case "completed":
      return item.status === "completed";
    case "cancelled":
      return ["cancelled", "refused", "expired"].includes(item.status);
    default:
      return true;
  }
}

function Countdown({ iso }: { iso: string }) {
  const left = Math.max(0, new Date(iso).getTime() - Date.now());
  const min = Math.floor(left / 60000);
  const sec = Math.floor((left % 60000) / 1000);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
      <Clock className="size-3" />
      {left > 0 ? `${min}:${String(sec).padStart(2, "0")} restantes` : "Délai dépassé"}
    </span>
  );
}

function AdminRides() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching } = useAdminRides();
  const [tab, setTab] = useState<TabKey>("active");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [day, setDay] = useState("");
  const [cancelTarget, setCancelTarget] = useState<AdminRideItem | null>(null);

  const items = data ?? [];

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { active: 0, planned: 0, completed: 0, cancelled: 0, all: items.length };
    for (const i of items) {
      for (const t of ["active", "planned", "completed", "cancelled"] as TabKey[]) {
        if (inTab(i, t)) c[t] += 1;
      }
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (!inTab(i, tab)) return false;
      if (status !== "all" && i.status !== status) return false;
      if (type === "immediate" && !i.isImmediate) return false;
      if (type === "planned" && i.isImmediate) return false;
      if (day && new Date(i.scheduledAt).toISOString().slice(0, 10) !== day) return false;
      if (!needle) return true;
      return [i.id, i.clientName, i.driverName, i.pickup, i.dropoff, RIDE_STATUS_LABELS[i.status] ?? i.status]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [items, tab, status, type, day, q]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Courses & demandes"
        description="Supervision temps réel de toute l'activité, avec annulation administrative synchronisée."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="flex w-full flex-wrap justify-start">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label} <span className="ml-1 text-muted-foreground">({counts[t.key]})</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Identifiant, client, chauffeur, ville, adresse…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(RIDE_STATUS_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Immédiates et planifiées</SelectItem>
            <SelectItem value="immediate">Immédiates</SelectItem>
            <SelectItem value="planned">Planifiées</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          <Button
            variant="outline"
            size="icon"
            title="Actualiser"
            onClick={() => void qc.invalidateQueries({ queryKey: ADMIN_RIDES_KEY })}
          >
            <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="Aucune course" description="Aucun élément ne correspond à ces filtres." />
      ) : (
        <div className="space-y-3">
          {filtered.map((i) => {
            const conflict =
              isActive(i) && !i.startedAt && new Date(i.scheduledAt).getTime() < Date.now() - 15 * 60_000;
            return (
              <div key={`${i.kind}-${i.id}`} className="surface space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={i.status} labels={RIDE_STATUS_LABELS} />
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {i.isImmediate ? "Immédiate" : "Planifiée"}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{i.source}</span>
                  {i.responseDeadline && isActive(i) ? <Countdown iso={i.responseDeadline} /> : null}
                  {conflict ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      <AlertTriangle className="size-3" /> Retard sur la prise en charge
                    </span>
                  ) : null}
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{i.id.slice(0, 8)}</span>
                </div>

                <div className="grid gap-1 text-sm sm:grid-cols-2">
                  <p className="font-medium">
                    {i.pickup} → {i.dropoff}
                  </p>
                  <p className="text-muted-foreground sm:text-right">
                    {i.price != null ? formatEuro(i.price) : "Prix non défini"}
                  </p>
                  <p className="text-muted-foreground">
                    Client : {i.clientName} · Chauffeur : {i.driverName}
                  </p>
                  <p className="text-muted-foreground sm:text-right">
                    Prise en charge : {formatDateTime(i.scheduledAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Créée le {formatDateTime(i.createdAt)} · il y a {elapsedSince(i.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/admin/courses/$rideId" params={{ rideId: i.id }}>
                      <Eye className="size-4" /> Voir la course
                    </Link>
                  </Button>
                  {isActive(i) ? (
                    <Button size="sm" variant="destructive" onClick={() => setCancelTarget(i)}>
                      <Ban className="size-4" /> Annuler la course
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cancelTarget ? (
        <AdminCancelRideDialog
          open
          onOpenChange={(v) => !v && setCancelTarget(null)}
          rideId={cancelTarget.id}
          status={cancelTarget.status}
          onCancelled={() => setCancelTarget(null)}
        />
      ) : null}
    </div>
  );
}
