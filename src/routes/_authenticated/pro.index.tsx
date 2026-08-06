import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Inbox,
  Receipt,
  Users,
  Wallet,
  QrCode,
  Star,
  Car,
  Clock,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile, useMyVehicle, useMyDocuments } from "@/lib/driver-queries";
import { useDriverData, computeStats, periodRange, PERIOD_LABELS, type Period } from "@/lib/pro-stats";
import { StatusBadge } from "@/components/StatusBadge";
import { ActiveRidePanel } from "@/components/ActiveRidePanel";
import { RIDE_STATUS_LABELS, VERIFICATION_LABELS, formatDateTime, formatEuro } from "@/lib/labels";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/pro/")({
  component: ProOverview,
});

const PERIODS: Period[] = ["today", "week", "month", "year"];

function Tile({
  to,
  label,
  value,
  hint,
  icon,
}: {
  to?: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  const inner = (
    <div className="surface flex h-full flex-col justify-between gap-1 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        {icon ? <span className="shrink-0 text-primary [&_svg]:size-4">{icon}</span> : null}
      </div>
      <p className="truncate text-xl font-bold sm:text-2xl">{value}</p>
      {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
  return to ? (
    <Link to={to} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function ProOverview() {
  const { user, profile } = useAuth();
  const driver = useDriverProfile();
  const vehicle = useMyVehicle();
  const docs = useMyDocuments();
  const raw = useDriverData();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("month");

  // Toutes les statistiques se rafraîchissent automatiquement à chaque événement.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`pro-stats-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        void qc.invalidateQueries({ queryKey: ["driver-data"] });
        void qc.invalidateQueries({ queryKey: ["driver-rides"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_requests" }, () => {
        void qc.invalidateQueries({ queryKey: ["driver-data"] });
        void qc.invalidateQueries({ queryKey: ["driver-new-requests"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
        void qc.invalidateQueries({ queryKey: ["driver-data"] });
        void qc.invalidateQueries({ queryKey: ["driver-invoices"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  const stats = computeStats(raw.data, period);
  const rides = raw.data?.rides ?? [];
  const now = new Date();
  const upcoming = rides
    .filter((r) => new Date(r.scheduled_at) >= now && ["confirmed", "driver_enroute"].includes(r.status))
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
  const { start, end } = periodRange("today");
  const todayCount = rides.filter(
    (r) => +new Date(r.scheduled_at) >= +start && +new Date(r.scheduled_at) <= +end && r.status !== "cancelled",
  ).length;
  const pendingRequests = (raw.data?.requests ?? []).filter((r) =>
    ["new", "reviewing", "awaiting_client", "proposal_sent"].includes(r.status),
  );
  const unpaid = (raw.data?.invoices ?? []).filter((i) => !["paid", "cancelled", "draft"].includes(i.status));
  const drafts = (raw.data?.invoices ?? []).filter((i) => i.status === "draft");

  const alerts: string[] = [];
  const v = vehicle.data;
  const soon = (d?: string | null) => d && new Date(d).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 45;
  if (soon(v?.insurance_expires_at)) alerts.push("Votre assurance arrive bientôt à expiration.");
  if (soon(v?.inspection_expires_at)) alerts.push("Votre contrôle technique arrive bientôt à expiration.");
  if (soon(v?.next_service_date)) alerts.push("Vous devriez prévoir l'entretien du véhicule.");
  if (drafts.length) alerts.push(`${drafts.length} facture(s) à compléter après course.`);
  (docs.data ?? []).forEach((d) => {
    if (d.status === "rejected") alerts.push(`Document refusé : ${d.doc_type}. Une correction est demandée.`);
    if (soon(d.expires_at)) alerts.push(`Un document arrive à expiration (${d.doc_type}).`);
  });

  const onDuty = !!driver.data?.on_duty;
  async function toggleDuty() {
    if (!user?.id || dutyBusy) return;
    setDutyBusy(true);
    const { error } = await supabase
      .from("driver_profiles")
      .update({ on_duty: !onDuty })
      .eq("user_id", user.id);
    setDutyBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["driver-profile"] });
    toast.success(!onDuty ? "Vous êtes disponible" : "Vous êtes indisponible", {
      description: !onDuty
        ? "Vos clients peuvent demander une course immédiate."
        : "Vous ne recevrez que des demandes « plus tard ».",
    });
  }

  return (
    <div className="w-full space-y-4">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">
            Bonjour {profile?.full_name?.split(" ")[0] ?? ""}
          </h1>
          <p className="truncate text-xs text-muted-foreground">Votre activité en temps réel.</p>
        </div>
        <Link
          to="/pro/profil"
          aria-label="Mon QR code"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          <QrCode className="size-4" />
          <span className="hidden sm:inline">Mon QR code</span>
        </Link>
      </header>

      <button
        type="button"
        onClick={() => void toggleDuty()}
        disabled={dutyBusy}
        aria-pressed={onDuty}
        className={`surface grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 text-left transition-colors ${
          onDuty ? "border-primary/40 bg-primary/5" : ""
        }`}
      >
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-full ${
            onDuty ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Power className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {onDuty ? "Disponible" : "Indisponible"}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {onDuty
              ? "Vous recevez les courses immédiates."
              : "Uniquement les demandes « plus tard »."}
          </span>
        </span>
        <span
          className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            onDuty ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`size-5 rounded-full bg-card shadow transition-transform ${
              onDuty ? "translate-x-5" : ""
            }`}
          />
        </span>
      </button>


      {driver.data && driver.data.verification_status !== "verified" ? (
        <Link to="/pro/profil" className="surface block border-warning/40 bg-warning/10 p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                Statut du compte
                <StatusBadge status={driver.data.verification_status} labels={VERIFICATION_LABELS} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Page publique activée après validation par un administrateur.
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </div>
        </Link>
      ) : null}

      <ActiveRidePanel />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              period === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Tile
          to="/pro/courses"
          label="Demandes"
          value={pendingRequests.length}
          hint="à traiter"
          icon={<Inbox />}
        />
        <Tile label="Aujourd'hui" value={todayCount} hint="courses" icon={<Car />} />
        <Tile
          to="/pro/factures"
          label="CA encaissé"
          value={formatEuro(stats.collected)}
          hint={`Facturé ${formatEuro(stats.billed)}`}
          icon={<Wallet />}
        />
        <Tile
          to="/pro/clients"
          label="Clients"
          value={raw.data?.conns.length ?? 0}
          hint={`${stats.regularClients} réguliers`}
          icon={<Users />}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Tile label="Terminées" value={stats.completed} />
        <Tile label="Panier moyen" value={formatEuro(stats.average)} />
        <Tile label="Acceptation" value={`${stats.acceptRate}%`} />
        <Tile
          label="Note"
          value={stats.reviews.count ? `${stats.reviews.average.toFixed(1)}/5` : "—"}
          hint={`${stats.reviews.count} avis`}
          icon={<Star />}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="surface p-4 lg:col-span-2">
          <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <h2 className="truncate text-sm font-semibold">Prochaines courses</h2>
            <Link to="/pro/courses" className="shrink-0 text-xs font-medium text-primary">
              Tout voir
            </Link>
          </div>
          {upcoming.length ? (
            <ul className="divide-y divide-border">
              {upcoming.slice(0, 4).map((r) => (
                <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {r.pickup_address} → {r.dropoff_address}
                    </p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Clock className="size-3 shrink-0" /> {formatDateTime(r.scheduled_at)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} labels={RIDE_STATUS_LABELS} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune course planifiée.</p>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <Link to="/pro/factures" className="surface block p-4">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <Receipt className="size-4 shrink-0 text-primary" /> À encaisser
            </h2>
            <p className="text-xl font-bold">{unpaid.length}</p>
            <p className="truncate text-xs text-muted-foreground">{formatEuro(stats.outstanding)} en attente</p>
          </Link>
          <div className="surface p-4">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 shrink-0 text-warning" /> Alertes
            </h2>
            {alerts.length ? (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {alerts.slice(0, 3).map((a) => (
                  <li key={a} className="line-clamp-2">
                    • {a}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Aucune alerte.</p>
            )}
          </div>
        </div>
      </div>

      {stats.reviews.latest.length ? (
        <section className="surface p-4">
          <h2 className="mb-2 text-sm font-semibold">Derniers avis clients</h2>
          <ul className="space-y-2">
            {stats.reviews.latest.slice(0, 3).map((r) => (
              <li key={r.id} className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium text-primary">{"★".repeat(r.rating)}</p>
                {r.comment ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.comment}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
