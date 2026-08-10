import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, ChevronRight, Clock3, FileText, Inbox, MapPin, User2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, INVOICE_LABELS, formatEuro } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/espace/courses/")({
  head: () => ({
    meta: [
      { title: "Mes courses — Relink" },
      {
        name: "description",
        content:
          "Suivez vos trajets Relink en cours, retrouvez vos courses terminées et vos courses annulées avec leurs factures.",
      },
      { property: "og:title", content: "Mes courses — Relink" },
      { property: "og:description", content: "Trajets en cours, terminés et annulés avec leurs factures." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientRides,
});

type Tab = "upcoming" | "completed" | "cancelled";

type RideRow = {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  scheduled_at: string;
  price: number | string | null;
  status: string;
  driver_id: string;
  is_block?: boolean | null;
};
type InvoiceRow = { ride_id: string | null; number: string; status: string };

function dateParts(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
    time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
}

function InvoiceHint({ invoice }: { invoice?: InvoiceRow | undefined }) {
  if (!invoice) return null;
  const label = invoice.status === "paid" ? "Payée" : INVOICE_LABELS[invoice.status] ?? "Facture disponible";
  return (
    <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <FileText className="size-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function Trip({ from, to }: { from: string; to: string }) {
  return (
    <div className="relative min-w-0 space-y-1.5 pl-4">
      <span className="absolute top-1.5 left-[3px] h-[calc(100%-0.75rem)] w-px bg-border" />
      <p className="relative line-clamp-2 text-sm leading-snug font-medium break-words">
        <span className="absolute top-1.5 -left-4 size-2 rounded-full bg-primary" />
        {from}
      </p>
      <p className="relative line-clamp-2 text-sm leading-snug break-words text-muted-foreground">
        <MapPin className="absolute top-0.5 -left-[1.05rem] size-3 text-primary" />
        {to}
      </p>
    </div>
  );
}

function RideRowCard({
  ride,
  invoice,
  driverName,
  featured,
}: {
  ride: RideRow;
  invoice?: InvoiceRow | undefined;
  driverName?: string | undefined;
  featured?: boolean;
}) {
  const { date, time } = dateParts(ride.scheduled_at);
  const cancelled = ride.status === "cancelled";
  const cta =
    ["driver_enroute", "driver_arrived", "client_onboard", "in_progress"].includes(ride.status)
      ? "Suivre la course"
      : "Voir les détails";
  return (
    <Link
      to="/espace/suivi/$id"
      params={{ id: ride.id }}
      className={cn(
        "block rounded-2xl border bg-card p-3 shadow-sm transition-colors active:scale-[0.995]",
        featured
          ? "border-primary/40 bg-primary/5"
          : cancelled
            ? "border-destructive/20 bg-destructive/5"
            : "border-border hover:bg-muted/40",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <StatusBadge status={ride.status} labels={RIDE_STATUS_LABELS} />
        <span className="ml-auto flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
          <CalendarDays className="size-3.5" />
          {date}
          <Clock3 className="ml-1 size-3.5" />
          {time}
        </span>
      </div>

      <div className="mt-2.5">
        <Trip from={ride.pickup_address} to={ride.dropoff_address} />
      </div>

      <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/70 pt-2 text-xs text-muted-foreground">
        {ride.price != null ? (
          <span className="font-semibold text-foreground">{formatEuro(Number(ride.price))}</span>
        ) : null}
        {driverName ? (
          <span className="inline-flex min-w-0 items-center gap-1">
            <User2 className="size-3 shrink-0" />
            <span className="max-w-[8rem] truncate">{driverName}</span>
          </span>
        ) : null}
        <InvoiceHint invoice={invoice} />
        <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 font-semibold text-primary">
          {featured ? cta : "Détails"} <ChevronRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}

function Empty({ title, description, action }: { title: string; description: string; action?: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-center">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      {action ? (
        <Link
          to="/espace/demandes"
          className="mt-3 inline-flex h-9 items-center rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground"
        >
          Réserver une course
        </Link>
      ) : null}
    </div>
  );
}

function ClientRides() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("upcoming");

  const data = useQuery({
    queryKey: ["client-rides", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [{ data: rides }, { data: invoices }, { data: requests }] = await Promise.all([
        supabase.from("rides").select("*").eq("client_id", user!.id).order("scheduled_at", { ascending: false }),
        supabase.from("invoices").select("*").eq("client_id", user!.id),
        supabase.from("ride_requests").select("id, status").eq("client_id", user!.id),
      ]);
      const ids = [...new Set((rides ?? []).map((r) => r.driver_id))];
      const names: Record<string, string> = {};
      if (ids.length) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        (profiles ?? []).forEach((p) => {
          if (p.full_name) names[p.id] = p.full_name;
        });
      }
      return { rides: rides ?? [], invoices: invoices ?? [], requests: requests ?? [], names };
    },
  });

  const rides = (data.data?.rides ?? []) as RideRow[];
  const invoices = (data.data?.invoices ?? []) as InvoiceRow[];
  const names = data.data?.names ?? {};
  const invoiceFor = (id: string) => invoices.find((i) => i.ride_id === id);

  const pendingRequests = (data.data?.requests ?? []).filter((r) =>
    ["new", "reviewing", "proposal_sent", "awaiting_client"].includes(r.status),
  ).length;

  const upcoming = rides
    .filter((r) => !["completed", "cancelled"].includes(r.status))
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
  const completed = rides.filter((r) => r.status === "completed");
  const cancelled = rides.filter((r) => r.status === "cancelled");

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "upcoming", label: "À venir", count: upcoming.length },
    { key: "completed", label: "Terminées", count: completed.length },
    { key: "cancelled", label: "Annulées", count: cancelled.length },
  ];

  const list = tab === "upcoming" ? upcoming : tab === "completed" ? completed : cancelled;
  const [featured, ...rest] = tab === "upcoming" ? upcoming : [];

  return (
    <div className="space-y-3 overflow-x-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header className="min-w-0">
        <h1 className="truncate text-lg font-bold tracking-tight">Mes courses</h1>
        <p className="truncate text-xs text-muted-foreground">Suivez vos réservations et retrouvez vos trajets.</p>
      </header>

      <Link
        to="/espace/courses/demandes"
        className="flex items-center gap-2.5 rounded-2xl border border-border bg-card p-2.5 shadow-sm transition-colors hover:bg-muted/40 active:scale-[0.99]"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <Inbox className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">Mes demandes</span>
          <span className="block truncate text-xs text-muted-foreground">Consultez vos demandes en attente</span>
        </span>
        {pendingRequests > 0 ? (
          <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning-foreground">
            {pendingRequests} en attente
          </span>
        ) : null}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={cn(
              "flex h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 text-xs font-semibold transition-colors",
              tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            <span className="truncate">{t.label}</span>
            <span className="shrink-0 opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {data.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-muted" />
          ))}
        </div>
      ) : data.isError ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          Impossible de charger vos courses. Réessayez dans quelques instants.
        </p>
      ) : list.length === 0 ? (
        tab === "upcoming" ? (
          <Empty title="Aucune course à venir" description="Vos prochaines réservations apparaîtront ici." action />
        ) : tab === "completed" ? (
          <Empty title="Aucune course terminée" description="Vos trajets effectués apparaîtront ici." />
        ) : (
          <Empty title="Aucune course annulée" description="Vous n'avez aucune course annulée." />
        )
      ) : (
        <div className="animate-fade-in space-y-2">
          {tab === "upcoming" ? (
            <>
              {featured ? (
                <RideRowCard
                  ride={featured}
                  invoice={invoiceFor(featured.id)}
                  driverName={names[featured.driver_id]}
                  featured
                />
              ) : null}
              {rest.map((r) => (
                <RideRowCard key={r.id} ride={r} invoice={invoiceFor(r.id)} driverName={names[r.driver_id]} />
              ))}
            </>
          ) : (
            list.map((r) => (
              <RideRowCard key={r.id} ride={r} invoice={invoiceFor(r.id)} driverName={names[r.driver_id]} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
