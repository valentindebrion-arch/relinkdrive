import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CarFront,
  ChevronRight,
  Clock3,
  FileText,
  Inbox,
  MapPin,
  Repeat2,
  Search,
  SlidersHorizontal,
  User2,
  X,
} from "lucide-react";
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
  completed_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  is_block?: boolean | null;
};
type InvoiceRow = { ride_id: string | null; number: string | null; status: string };

const ACTIVE_STATUSES = ["driver_enroute", "driver_arrived", "client_onboard", "in_progress"];
const PROGRESS_STEPS: { key: string; label: string }[] = [
  { key: "confirmed", label: "Confirmée" },
  { key: "driver_enroute", label: "Chauffeur en route" },
  { key: "driver_arrived", label: "Chauffeur arrivé" },
  { key: "in_progress", label: "En course" },
  { key: "completed", label: "Terminée" },
];

function progressIndex(status: string) {
  if (status === "client_onboard") return 3;
  const i = PROGRESS_STEPS.findIndex((s) => s.key === status);
  return i;
}

function dateParts(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
    time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
}

function Trip({ from, to }: { from: string; to: string }) {
  return (
    <div className="relative min-w-0 space-y-1.5 pl-4">
      <span aria-hidden className="absolute top-1.5 left-[3px] h-[calc(100%-0.75rem)] w-px bg-border" />
      <p className="relative line-clamp-2 text-sm leading-snug font-medium break-words">
        <span aria-hidden className="absolute top-1.5 -left-4 size-2 rounded-full bg-primary" />
        {from}
      </p>
      <p className="relative line-clamp-2 text-sm leading-snug break-words text-muted-foreground">
        <MapPin aria-hidden className="absolute top-0.5 -left-[1.05rem] size-3 text-primary" />
        {to}
      </p>
    </div>
  );
}

function MetaRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/70 pt-2 text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function DriverChip({ name }: { name?: string | undefined }) {
  if (!name) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <User2 aria-hidden className="size-3 shrink-0" />
      <span className="max-w-[8rem] truncate">{name}</span>
    </span>
  );
}

function InvoiceHint({ invoice }: { invoice?: InvoiceRow | undefined }) {
  if (!invoice) return null;
  const label = invoice.status === "paid" ? "Payée" : (INVOICE_LABELS[invoice.status] ?? "Facture disponible");
  return (
    <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <FileText aria-hidden className="size-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

/* ---------------- Course active ---------------- */

function ActiveRideCard({ ride, driverName }: { ride: RideRow; driverName?: string | undefined }) {
  const { date, time } = dateParts(ride.scheduled_at);
  const current = progressIndex(ride.status);
  return (
    <section
      aria-label="Course en cours"
      className="rounded-2xl border border-primary/35 bg-primary/[0.04] p-3.5 shadow-sm"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
          <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-primary" />
          Course en cours
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
          <CalendarDays aria-hidden className="size-3.5" />
          {date}
          <Clock3 aria-hidden className="ml-1 size-3.5" />
          {time}
        </span>
      </div>

      <div className="mt-3">
        <Trip from={ride.pickup_address} to={ride.dropoff_address} />
      </div>

      <ol className="mt-3 flex items-center gap-1" aria-label="Progression de la course">
        {PROGRESS_STEPS.map((s, i) => (
          <li key={s.key} className="min-w-0 flex-1">
            <span
              aria-hidden
              className={cn(
                "block h-1 rounded-full transition-colors",
                current >= 0 && i <= current ? "bg-primary" : "bg-border",
              )}
            />
            <span
              className={cn(
                "mt-1 block truncate text-[10px] leading-tight",
                current === i ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={ride.status} labels={RIDE_STATUS_LABELS} />
        <DriverChip name={driverName} />
        {ride.price != null ? (
          <span className="text-xs font-semibold text-foreground">{formatEuro(Number(ride.price))}</span>
        ) : null}
        <Link
          to="/espace/suivi/$id"
          params={{ id: ride.id }}
          className="ml-auto inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-primary px-3.5 text-xs font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Voir ma course <ChevronRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}

/* ---------------- Cartes de liste ---------------- */

function RideRowCard({
  ride,
  invoice,
  driverName,
  variant,
  next,
  onRebook,
}: {
  ride: RideRow;
  invoice?: InvoiceRow | undefined;
  driverName?: string | undefined;
  variant: Tab;
  next?: boolean;
  onRebook?: () => void;
}) {
  const { date, time } = dateParts(
    variant === "completed" ? (ride.completed_at ?? ride.scheduled_at) : (ride.cancelled_at ?? ride.scheduled_at),
  );
  const cancelled = variant === "cancelled";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-3 shadow-sm transition-colors",
        next
          ? "border-primary/40 bg-primary/[0.03]"
          : cancelled
            ? "border-destructive/20 bg-destructive/[0.03]"
            : "border-border",
      )}
    >
      <Link
        to="/espace/suivi/$id"
        params={{ id: ride.id }}
        className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <div className="flex min-w-0 items-center gap-2">
          {next ? (
            <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
              Prochaine course
            </span>
          ) : null}
          <StatusBadge status={ride.status} labels={RIDE_STATUS_LABELS} />
          <span className="ml-auto flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
            <CalendarDays aria-hidden className="size-3.5" />
            {date}
            <Clock3 aria-hidden className="ml-1 size-3.5" />
            {time}
          </span>
        </div>

        <div className="mt-2.5">
          <Trip from={ride.pickup_address} to={ride.dropoff_address} />
        </div>

        <MetaRow>
          {ride.price != null ? (
            <span className="font-semibold text-foreground">{formatEuro(Number(ride.price))}</span>
          ) : variant === "upcoming" ? (
            <span>Tarif à confirmer</span>
          ) : null}
          <DriverChip name={driverName} />
          <InvoiceHint invoice={invoice} />
          <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 font-semibold text-primary">
            Détails <ChevronRight aria-hidden className="size-3.5" />
          </span>
        </MetaRow>
      </Link>

      {cancelled && (ride.cancellation_reason || ride.cancelled_by) ? (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {ride.cancelled_by ? "Annulation enregistrée" : null}
          {ride.cancellation_reason ? ` · ${ride.cancellation_reason}` : ""}
        </p>
      ) : null}

      {variant !== "upcoming" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {variant === "completed" && invoice ? (
            <Link
              to="/espace/suivi/$id"
              params={{ id: ride.id }}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <FileText aria-hidden className="size-3.5" /> Voir le reçu
            </Link>
          ) : null}
          {variant === "completed" ? (
            <button
              type="button"
              onClick={onRebook}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/30 px-2.5 text-xs font-semibold text-primary hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Repeat2 aria-hidden className="size-3.5" /> Réserver à nouveau
            </button>
          ) : (
            <Link
              to="/aide"
              className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Contacter l'assistance
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- États vides ---------------- */

function EmptyUpcoming({ onSeeCompleted }: { onSeeCompleted: () => void }) {
  return (
    <div className="flex min-h-[38dvh] flex-col items-center justify-center px-6 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <CarFront aria-hidden className="size-7" />
      </span>
      <p className="mt-3 text-base font-semibold">Aucun trajet prévu</p>
      <p className="mt-1 text-sm text-muted-foreground">Votre prochaine réservation apparaîtra ici.</p>
      <Link
        to="/espace"
        hash="reserver"
        className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        Réserver une course
      </Link>
      <button
        type="button"
        onClick={onSeeCompleted}
        className="mt-2.5 text-sm font-medium text-muted-foreground underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        Retrouver une course terminée
      </button>
    </div>
  );
}

function EmptySimple({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[30dvh] flex-col items-center justify-center px-6 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <CalendarDays aria-hidden className="size-6" />
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

/* ---------------- Page ---------------- */

const PAGE_SIZE = 8;

function ClientRides() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [showSearch, setShowSearch] = useState(false);
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [rebookRide, setRebookRide] = useState<RideRow | null>(null);

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

  const pendingList = (data.data?.requests ?? []).filter((r) =>
    ["new", "reviewing", "proposal_sent", "awaiting_client"].includes(r.status),
  );
  const pendingRequests = pendingList.length;
  /** Une seule demande en attente : on ouvre directement son suivi. */
  const singlePending = pendingRequests === 1 ? pendingList[0]! : null;

  const upcomingAll = useMemo(
    () =>
      rides
        .filter((r) => !["completed", "cancelled"].includes(r.status))
        .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at)),
    [rides],
  );
  const active = upcomingAll.find((r) => ACTIVE_STATUSES.includes(r.status));
  const upcoming = upcomingAll.filter((r) => r.id !== active?.id);
  const completed = rides.filter((r) => r.status === "completed");
  const cancelled = rides.filter((r) => r.status === "cancelled");

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "upcoming", label: "À venir", count: upcomingAll.length },
    { key: "completed", label: "Terminées", count: completed.length },
    { key: "cancelled", label: "Annulées", count: cancelled.length },
  ];

  const base = tab === "upcoming" ? upcoming : tab === "completed" ? completed : cancelled;
  const needle = q.trim().toLowerCase();
  const list = needle
    ? base.filter((r) =>
        [r.pickup_address, r.dropoff_address, names[r.driver_id] ?? "", RIDE_STATUS_LABELS[r.status] ?? r.status]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
    : base;
  const paged = list.slice(0, visible);

  const selectTab = (t: Tab) => {
    setTab(t);
    setVisible(PAGE_SIZE);
  };

  const canSearch = base.length > 4 || needle.length > 0;

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-4 overflow-x-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header className="min-w-0 pt-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Mes courses</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gérez vos réservations et retrouvez vos trajets.</p>
      </header>

      <Link
        {...(singlePending
          ? ({ to: "/espace/suivi/$id", params: { id: singlePending.id } } as const)
          : ({ to: "/espace/courses/demandes" } as const))}
        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-[0_1px_6px_rgba(0,0,0,0.04)] transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.99]"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Inbox aria-hidden className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {singlePending ? "Suivre ma demande" : "Mes demandes"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {singlePending
              ? "En attente de la réponse du chauffeur"
              : pendingRequests > 0
                ? `${pendingRequests} demande${pendingRequests > 1 ? "s" : ""} en attente de réponse`
                : "Aucune demande en attente"}
          </span>
        </span>
        {pendingRequests > 0 ? (
          <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning-foreground">
            {pendingRequests} en attente
          </span>
        ) : null}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </Link>

      {active ? <ActiveRideCard ride={active} driverName={names[active.driver_id]} /> : null}

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted/70 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => selectTab(t.key)}
            aria-pressed={tab === t.key}
            className={cn(
              "flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-1 text-xs font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/70",
            )}
          >
            <span className="truncate">{t.label}</span>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold",
                tab === t.key ? "bg-primary-foreground/20" : "bg-background text-muted-foreground",
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {canSearch ? (
        <div className="flex items-center gap-2">
          {showSearch ? (
            <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3">
              <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setVisible(PAGE_SIZE);
                }}
                placeholder="Adresse, ville, chauffeur, statut…"
                aria-label="Rechercher une course"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                aria-label="Fermer la recherche"
                onClick={() => {
                  setQ("");
                  setShowSearch(false);
                }}
                className="shrink-0 text-muted-foreground"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-medium text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <SlidersHorizontal aria-hidden className="size-3.5" /> Rechercher / filtrer
            </button>
          )}
        </div>
      ) : null}

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
        <div className="flex flex-1 items-center justify-center">
          {needle ? (
            <EmptySimple title="Aucun résultat" description="Essayez une autre adresse, ville ou chauffeur." />
          ) : tab === "upcoming" ? (
            active ? (
              <EmptySimple
                title="Aucune autre course prévue"
                description="Votre course en cours est affichée ci-dessus."
              />
            ) : (
              <EmptyUpcoming onSeeCompleted={() => selectTab("completed")} />
            )
          ) : tab === "completed" ? (
            <EmptySimple title="Aucune course terminée" description="Vos trajets effectués apparaîtront ici." />
          ) : (
            <EmptySimple title="Aucune course annulée" description="Vous n'avez aucune course annulée." />
          )}
        </div>
      ) : (
        <div className="animate-fade-in space-y-2">
          {paged.map((r, i) => (
            <RideRowCard
              key={r.id}
              ride={r}
              invoice={invoiceFor(r.id)}
              driverName={names[r.driver_id]}
              variant={tab}
              next={tab === "upcoming" && i === 0 && !needle}
              onRebook={() => setRebookRide(r)}
            />
          ))}
          {list.length > paged.length ? (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="h-10 w-full rounded-xl border border-border bg-card text-xs font-semibold text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Afficher plus ({list.length - paged.length})
            </button>
          ) : null}
        </div>
      )}

      {rebookRide ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Réserver à nouveau"
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-3"
          onClick={() => setRebookRide(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">Réserver à nouveau</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Vérifiez et confirmez les détails de votre trajet avant de valider la nouvelle réservation.
            </p>
            <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
              <Trip from={rebookRide.pickup_address} to={rebookRide.dropoff_address} />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setRebookRide(null)}
                className="h-10 flex-1 rounded-xl border border-border text-xs font-semibold"
              >
                Annuler
              </button>
              <Link
                to="/espace/demandes"
                search={{ driver: rebookRide.driver_id }}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-primary text-xs font-semibold text-primary-foreground"
              >
                Vérifier et réserver
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
