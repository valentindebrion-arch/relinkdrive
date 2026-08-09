import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
  MapPin,
  Power,
  QrCode,
  Receipt,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile, useMyVehicle, useMyDocuments } from "@/lib/driver-queries";
import { useDriverData, computeStats, PERIOD_LABELS, type Period } from "@/lib/pro-stats";
import { StatusBadge } from "@/components/StatusBadge";
import { ActiveRidePanel } from "@/components/ActiveRidePanel";
import { RIDE_STATUS_LABELS, VERIFICATION_LABELS, formatDate, formatEuro } from "@/lib/labels";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/pro/")({
  component: ProOverview,
});

const PERIODS: Period[] = ["today", "week", "month", "year"];

function timeOf(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function countdown(iso?: string | null) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0 || diff > 1000 * 60 * 60 * 48) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h ? `dans ${h} h ${String(m).padStart(2, "0")}` : `dans ${m} min`;
}

/** Taille de police adaptée à la longueur du montant : jamais de débordement. */
function figureSize(text: string) {
  if (text.length > 12) return "text-sm";
  if (text.length > 9) return "text-base";
  if (text.length > 6) return "text-lg";
  return "text-xl";
}

function Figure({ to, label, value, hint }: { to?: string; label: string; value: string; hint?: ReactNode }) {
  const inner = (
    <div className="surface flex h-full min-w-0 flex-col justify-between gap-1 p-3">
      <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`truncate font-bold tabular-nums ${figureSize(value)}`}>{value}</p>
      {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
  return to ? (
    <Link to={to} className="block min-w-0">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function Micro({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/50 p-2.5">
      <p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
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
  const [dutyBusy, setDutyBusy] = useState(false);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);

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
  const next = upcoming[0];
  const pendingRequests = (raw.data?.requests ?? [])
    .filter((r) => ["new", "reviewing", "awaiting_client", "proposal_sent"].includes(r.status))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const topRequest = pendingRequests[0];
  const unpaidCount = (raw.data?.invoices ?? []).filter((i) => !["paid", "cancelled", "draft"].includes(i.status)).length;
  const drafts = (raw.data?.invoices ?? []).filter((i) => i.status === "draft");
  const clientsCount = new Set(
    rides.filter((r) => r.status === "completed" && r.client_id).map((r) => r.client_id),
  ).size;
  const periodClients = stats.perClient?.length ?? 0;

  type Alert = { key: string; title: string; text: string; level: "danger" | "warning"; to: string; action: string };
  const alerts: Alert[] = [];
  const v = vehicle.data;
  const soon = (d?: string | null) => d && new Date(d).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 45;
  if (soon(v?.insurance_expires_at))
    alerts.push({
      key: "ins",
      title: "Assurance bientôt expirée",
      text: `Votre attestation d'assurance expire le ${formatDate(v?.insurance_expires_at)}. Mettez-la à jour pour rester visible.`,
      level: "warning",
      to: "/pro/profil?section=vehicule",
      action: "Mettre à jour",
    });
  if (soon(v?.inspection_expires_at))
    alerts.push({
      key: "insp",
      title: "Contrôle technique à renouveler",
      text: `Le contrôle technique de votre véhicule expire le ${formatDate(v?.inspection_expires_at)}.`,
      level: "warning",
      to: "/pro/profil?section=vehicule",
      action: "Mettre à jour",
    });
  if (soon(v?.next_service_date))
    alerts.push({
      key: "serv",
      title: "Entretien à prévoir",
      text: `L'entretien de votre véhicule est prévu autour du ${formatDate(v?.next_service_date)}.`,
      level: "warning",
      to: "/pro/profil?section=vehicule",
      action: "Voir mon véhicule",
    });
  if (drafts.length)
    alerts.push({
      key: "drafts",
      title: `${drafts.length} facture(s) à compléter`,
      text: "Des factures restent à finaliser après course pour être envoyées au client.",
      level: "warning",
      to: "/pro/factures",
      action: "Voir les factures",
    });
  (docs.data ?? []).forEach((d) => {
    if (d.status === "rejected")
      alerts.push({
        key: `rej-${d.id}`,
        title: "Document refusé",
        text: `Le document « ${d.doc_type} » a été refusé. Envoyez une nouvelle version pour finaliser votre vérification.`,
        level: "danger",
        to: "/pro/profil?section=verification",
        action: "Ajouter le document",
      });
    if (soon(d.expires_at))
      alerts.push({
        key: `exp-${d.id}`,
        title: "Document bientôt expiré",
        text: `Le document « ${d.doc_type} » expire le ${formatDate(d.expires_at)}.`,
        level: "warning",
        to: "/pro/profil?section=verification",
        action: "Mettre à jour",
      });
  });

  const onDuty = !!driver.data?.on_duty;
  async function toggleDuty() {
    if (!user?.id || dutyBusy) return;
    setDutyBusy(true);
    const { error } = await supabase.from("driver_profiles").update({ on_duty: !onDuty }).eq("user_id", user.id);
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

  const loading = raw.isLoading;
  const noActivity = !loading && stats.completed === 0 && stats.billed === 0 && stats.collected === 0;

  return (
    <div className="w-full space-y-3 pb-4">
      {/* 1. Salutation + QR */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">
            Bonjour {profile?.full_name?.split(" ")[0] ?? ""} <span aria-hidden>👋</span>
          </h1>
          <p className="truncate text-xs text-muted-foreground">Voici l'essentiel de votre activité.</p>
        </div>
        <Link
          to="/pro/qr"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          <QrCode className="size-4" />
          Mon QR code
        </Link>
      </header>

      {/* 2. Disponibilité */}
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
          {dutyBusy ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            {onDuty ? <CheckCircle2 className="size-3.5 shrink-0" /> : <span aria-hidden>—</span>}
            {onDuty ? "Disponible" : "Indisponible"}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {onDuty
              ? "Vous pouvez recevoir de nouvelles demandes."
              : "Vous ne recevez actuellement aucune nouvelle demande."}
          </span>
        </span>
        <span
          className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            onDuty ? "bg-primary" : "bg-muted"
          }`}
        >
          <span className={`size-5 rounded-full bg-card shadow transition-transform ${onDuty ? "translate-x-5" : ""}`} />
        </span>
      </button>

      {driver.data && driver.data.verification_status !== "verified" ? (
        <Link to="/pro/profil?section=verification" className="surface block border-warning/40 bg-warning/10 p-3">
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

      {/* 3. Demandes à traiter */}
      {loading ? (
        <div className="surface h-24 animate-pulse p-3" />
      ) : topRequest ? (
        <section className="surface border-primary/40 bg-primary/5 p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <Inbox className="size-4 shrink-0 text-primary" />
              <span className="truncate">Demandes à traiter</span>
            </h2>
            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
              {pendingRequests.length}
            </span>
          </div>
          <div className="mt-2 space-y-1 text-xs">
            <p className="flex items-center gap-1.5 font-medium">
              <Clock className="size-3.5 shrink-0 text-primary" />
              {topRequest.scheduled_at ? timeOf(topRequest.scheduled_at) : "Dès que possible"}
              {countdown(topRequest.scheduled_at) ? (
                <span className="text-muted-foreground">· {countdown(topRequest.scheduled_at)}</span>
              ) : null}
            </p>
            <p className="flex items-start gap-1.5">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
              <span className="min-w-0 flex-1 truncate">{topRequest.pickup_address}</span>
            </p>
            <p className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">{topRequest.dropoff_address}</span>
            </p>
            {topRequest.proposed_price != null ? (
              <p className="font-semibold">{formatEuro(Number(topRequest.proposed_price))}</p>
            ) : null}
          </div>
          <Link
            to="/pro/courses"
            className="mt-3 flex h-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
          >
            Ouvrir la demande
          </Link>
        </section>
      ) : (
        <Link to="/pro/courses" className="surface grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 p-2.5">
          <Inbox className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs text-muted-foreground">Aucune demande à traiter.</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      {/* 4. Prochaine course */}
      {next ? (
        <section className="surface p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <h2 className="truncate text-sm font-semibold">Prochaine course</h2>
            <StatusBadge status={next.status} labels={RIDE_STATUS_LABELS} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {formatDate(next.scheduled_at)} · {timeOf(next.scheduled_at)}
            </span>
            {countdown(next.scheduled_at) ? <span>{countdown(next.scheduled_at)}</span> : null}
          </p>
          <div className="mt-2 space-y-1 text-xs">
            <p className="flex items-start gap-1.5">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
              <span className="min-w-0 flex-1 truncate">{next.pickup_address}</span>
            </p>
            <p className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">{next.dropoff_address}</span>
            </p>
            {next.price != null ? <p className="font-semibold">{formatEuro(Number(next.price))}</p> : null}
          </div>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Link
              to="/pro/courses"
              className="flex h-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
            >
              Voir la course
            </Link>
            <Link
              to="/pro/planning"
              className="flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium"
            >
              <CalendarDays className="size-4 shrink-0" />
              Voir mon planning
            </Link>
          </div>
        </section>
      ) : (
        <div className="surface grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Aucune course à venir.</p>
            <p className="truncate text-[11px] text-muted-foreground">Vos prochaines réservations apparaîtront ici.</p>
          </div>
          <Link
            to="/pro/planning"
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium"
          >
            <CalendarDays className="size-4" />
            Planning
          </Link>
        </div>
      )}

      {/* 5. Sélecteur de période */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-1 sm:grid-cols-4">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            aria-pressed={period === p}
            className={`min-w-0 truncate rounded-xl px-2 py-2 text-xs font-medium transition-colors ${
              period === p ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* 6. Résumé principal */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="surface h-20 animate-pulse" />
          <div className="surface h-20 animate-pulse" />
          <div className="surface col-span-2 h-20 animate-pulse" />
        </div>
      ) : noActivity ? (
        <div className="surface p-3 text-xs text-muted-foreground">Aucune activité pour cette période.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Figure
              to="/pro/factures"
              label="CA encaissé"
              value={formatEuro(stats.collected)}
              hint={`Facturé ${formatEuro(stats.billed)}`}
            />
            <Figure to="/pro/courses" label="Courses terminées" value={String(stats.completed)} />
            <Figure
              to="/pro/clients"
              label="Clients"
              value={String(periodClients || clientsCount)}
              hint={periodClients ? "sur la période" : "au total"}
            />
          </div>

          {/* 7. Performances */}
          <section className="surface p-3">
            <h2 className="mb-2 text-sm font-semibold">Performances</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Micro label="Panier moyen" value={formatEuro(stats.average)} />
              <Micro label="Acceptation" value={`${stats.acceptRate}%`} />
              <Micro label="Annulation" value={`${stats.cancelRate}%`} />
              <Micro
                label="Note globale"
                value={stats.reviews.count ? `${stats.reviews.average.toFixed(1)}/5` : "—"}
              />
            </div>
          </section>
        </>
      )}

      {/* 8. Raccourci facturation */}
      <Link to="/pro/factures" className="surface grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 p-3">
        <Receipt className="size-4 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">Facturation</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {formatEuro(stats.outstanding)} restent à encaisser · {unpaidCount} facture(s)
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
          Voir les factures <ChevronRight className="size-4" />
        </span>
      </Link>

      {/* 9. Alertes */}
      {alerts.length ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Alertes</h2>
          {alerts.map((a) => (
            <Link
              key={a.key}
              to={a.to}
              className={`surface block p-3 ${
                a.level === "danger" ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/10"
              }`}
            >
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                <AlertTriangle
                  className={`mt-0.5 size-4 shrink-0 ${a.level === "danger" ? "text-destructive" : "text-warning"}`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="mt-0.5 text-xs break-words text-muted-foreground">{a.text}</p>
                  <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    {a.action} <ChevronRight className="size-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <div className="surface grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 p-2.5">
          <CheckCircle2 className="size-4 shrink-0 text-success" />
          <span className="truncate text-xs text-muted-foreground">Tout est à jour.</span>
        </div>
      )}

      {/* 10. Derniers avis */}
      <section className="surface p-3">
        <h2 className="mb-2 text-sm font-semibold">Derniers avis clients</h2>
        {stats.reviews.latest.length ? (
          <ul className="space-y-2">
            {stats.reviews.latest.slice(0, 2).map((r) => {
              const long = (r.comment ?? "").length > 110;
              const open = expandedReview === r.id;
              return (
                <li key={r.id} className="rounded-xl bg-muted/50 p-2.5">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                      <Star className="size-3.5" />
                    </span>
                    <span className="truncate text-xs font-semibold text-primary">{"★".repeat(r.rating)}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(r.created_at)}</span>
                  </div>
                  {r.comment ? (
                    <>
                      <p className={`mt-1 text-xs text-muted-foreground ${open ? "" : "line-clamp-2"}`}>{r.comment}</p>
                      {long ? (
                        <button
                          type="button"
                          onClick={() => setExpandedReview(open ? null : r.id)}
                          className="mt-1 text-[11px] font-semibold text-primary"
                        >
                          {open ? "Réduire" : "Lire la suite"}
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Aucun avis pour le moment.</p>
        )}
      </section>
    </div>
  );
}
