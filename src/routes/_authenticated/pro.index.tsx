import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Inbox, Receipt, Users, Wallet, QrCode, Star, Car, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile, useMyVehicle, useMyDocuments } from "@/lib/driver-queries";
import { useDriverData, computeStats, periodRange, PERIOD_LABELS, type Period } from "@/lib/pro-stats";
import { StatCard, PageHeader } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { ActiveRidePanel } from "@/components/ActiveRidePanel";
import { RIDE_STATUS_LABELS, VERIFICATION_LABELS, formatDateTime, formatEuro } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/pro/")({
  component: ProOverview,
});

const PERIODS: Period[] = ["today", "week", "month", "year"];

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

  return (
    <>
      <PageHeader
        title={`Bonjour ${profile?.full_name?.split(" ")[0] ?? ""}`}
        description="Votre activité en temps réel."
        action={
          <Link
            to="/pro/profil"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <QrCode className="size-4" /> Mon QR code
          </Link>
        }
      />

      {driver.data && driver.data.verification_status !== "verified" ? (
        <div className="surface mb-6 flex flex-wrap items-center justify-between gap-3 border-warning/40 bg-warning/10 p-4">
          <div>
            <p className="font-medium">
              Statut du compte : <StatusBadge status={driver.data.verification_status} labels={VERIFICATION_LABELS} />
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Votre page publique et vos demandes réelles seront activées après validation par un administrateur.
            </p>
          </div>
          <Link to="/pro/profil" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium">
            Compléter mon dossier
          </Link>
        </div>
      ) : null}

      <ActiveRidePanel />

      <div className="mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              period === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link to="/pro/courses" className="block">
          <StatCard label="Demandes à traiter" value={pendingRequests.length} icon={<Inbox className="size-4" />} />
        </Link>
        <StatCard label="Courses aujourd'hui" value={todayCount} icon={<Car className="size-4" />} />
        <Link to="/pro/factures" className="block">
          <StatCard
            label="CA encaissé"
            value={formatEuro(stats.collected)}
            hint={`Facturé ${formatEuro(stats.billed)}`}
            icon={<Wallet className="size-4" />}
          />
        </Link>
        <Link to="/pro/clients" className="block">
          <StatCard
            label="Clients fidélisés"
            value={raw.data?.conns.length ?? 0}
            hint={`${stats.regularClients} réguliers`}
            icon={<Users className="size-4" />}
          />
        </Link>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Courses terminées" value={stats.completed} />
        <StatCard label="Panier moyen" value={formatEuro(stats.average)} />
        <StatCard label="Taux d'acceptation" value={`${stats.acceptRate}%`} />
        <StatCard
          label="Note moyenne"
          value={stats.reviews.count ? `${stats.reviews.average.toFixed(1)}/5` : "—"}
          hint={`${stats.reviews.count} avis`}
          icon={<Star className="size-4" />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="surface p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Prochaines courses</h2>
            <Link to="/pro/courses" className="text-sm text-primary">
              Tout voir
            </Link>
          </div>
          {upcoming.length ? (
            <ul className="divide-y divide-border">
              {upcoming.slice(0, 6).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {r.pickup_address} → {r.dropoff_address}
                    </p>
                    <p className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="size-3.5" /> {formatDateTime(r.scheduled_at)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} labels={RIDE_STATUS_LABELS} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune course planifiée.</p>
          )}
        </div>

        <div className="space-y-4">
          <Link to="/pro/factures" className="surface block p-5">
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <Receipt className="size-4 text-primary" /> Factures à encaisser
            </h2>
            <p className="text-2xl font-semibold">{unpaid.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">{formatEuro(stats.outstanding)} en attente</p>
          </Link>
          <div className="surface p-5">
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4 text-warning" /> Alertes
            </h2>
            {alerts.length ? (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {alerts.slice(0, 4).map((a) => (
                  <li key={a}>• {a}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune alerte.</p>
            )}
          </div>
        </div>
      </div>

      {stats.reviews.latest.length ? (
        <div className="surface mt-6 p-5">
          <h2 className="mb-3 font-semibold">Derniers avis clients</h2>
          <ul className="space-y-3">
            {stats.reviews.latest.slice(0, 3).map((r) => (
              <li key={r.id} className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">{"★".repeat(r.rating)}</p>
                {r.comment ? <p className="mt-1 text-muted-foreground">{r.comment}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
