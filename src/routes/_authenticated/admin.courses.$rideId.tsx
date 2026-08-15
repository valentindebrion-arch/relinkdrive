import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { RIDE_STATUS_LABELS, formatDateTime, formatEuro, INVOICE_LABELS } from "@/lib/labels";
import { AdminCancelRideDialog } from "@/components/admin/AdminCancelRideDialog";
import {
  ACTIVE_REQUEST_STATUSES,
  ACTIVE_RIDE_STATUSES,
  adminCancelReasonLabel,
} from "@/lib/admin-rides";

export const Route = createFileRoute("/_authenticated/admin/courses/$rideId")({
  head: () => ({
    meta: [
      { title: "Détail de la course — Administration Relink" },
      {
        name: "description",
        content:
          "Détail administratif d'une course Relink : statut, chronologie, participants, tarif, paiement et gestion administrative de l'annulation.",
      },
      { property: "og:title", content: "Détail de la course — Administration Relink" },
      { property: "og:description", content: "Chronologie, participants et gestion administrative d'une course." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminRideDetail,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface p-4">
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}

function AdminRideDetail() {
  const { rideId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);

  const q = useQuery({
    queryKey: ["admin", "ride-detail", rideId],
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: ride } = await supabase.from("rides").select("*").eq("id", rideId).maybeSingle();
      const requestId = ride?.request_id ?? (ride ? null : rideId);
      const { data: request } = requestId
        ? await supabase.from("ride_requests").select("*").eq("id", requestId).maybeSingle()
        : { data: null };

      const userIds = [ride?.client_id, ride?.driver_id, request?.client_id, request?.driver_id].filter(
        Boolean,
      ) as string[];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("id, full_name, email, phone").in("id", userIds)
        : { data: [] };

      const { data: history } = await supabase
        .from("ride_status_history")
        .select("*")
        .or([ride ? `ride_id.eq.${ride.id}` : null, request ? `request_id.eq.${request.id}` : null]
          .filter(Boolean)
          .join(","))
        .order("created_at", { ascending: true });

      const { data: invoices } = ride
        ? await supabase.from("invoices").select("*").eq("ride_id", ride.id)
        : { data: [] };

      const { data: logs } = await supabase
        .from("audit_logs")
        .select("id, action, reason, created_at, new_value")
        .eq("resource_id", ride?.id ?? request?.id ?? rideId)
        .order("created_at", { ascending: false });

      return {
        ride,
        request,
        profiles: profiles ?? [],
        history: history ?? [],
        invoices: invoices ?? [],
        logs: logs ?? [],
      };
    },
  });

  // Temps réel : une ancienne page ouverte reflète immédiatement l'état réel.
  useEffect(() => {
    const channel = supabase
      .channel(`admin-ride-${rideId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        void qc.invalidateQueries({ queryKey: ["admin", "ride-detail", rideId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_requests" }, () => {
        void qc.invalidateQueries({ queryKey: ["admin", "ride-detail", rideId] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [rideId, qc]);

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  const ride = q.data?.ride ?? null;
  const request = q.data?.request ?? null;
  if (!ride && !request) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/courses">
            <ArrowLeft className="size-4" /> Retour
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Course introuvable.</p>
      </div>
    );
  }

  const status = ride?.status ?? request!.status;
  const clientId = ride?.client_id ?? request?.client_id ?? null;
  const driverId = ride?.driver_id ?? request?.driver_id ?? null;
  const person = (id: string | null) => q.data?.profiles.find((p) => p.id === id) ?? null;
  const active = ride
    ? (ACTIVE_RIDE_STATUSES as readonly string[]).includes(status)
    : (ACTIVE_REQUEST_STATUSES as readonly string[]).includes(status);
  const invoice = q.data?.invoices[0] ?? null;

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/courses">
            <ArrowLeft className="size-4" /> Retour aux courses
          </Link>
        </Button>
        <StatusBadge status={status} labels={RIDE_STATUS_LABELS} />
        <span className="font-mono text-xs text-muted-foreground">{ride?.id ?? request!.id}</span>
      </div>

      <Section title="Course">
        <Row label="Type" value={request?.is_immediate ? "Immédiate" : "Planifiée"} />
        <Row label="Créée le" value={formatDateTime(ride?.created_at ?? request!.created_at)} />
        <Row label="Prise en charge" value={formatDateTime(ride?.scheduled_at ?? request!.scheduled_at)} />
        <Row label="Départ" value={ride?.pickup_address ?? request!.pickup_address} />
        <Row label="Destination" value={ride?.dropoff_address ?? request!.dropoff_address} />
        <Row label="Démarrée le" value={ride?.started_at ? formatDateTime(ride.started_at) : "—"} />
        <Row label="Terminée le" value={ride?.completed_at ? formatDateTime(ride.completed_at) : "—"} />
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Client">
          <Row label="Nom" value={person(clientId)?.full_name ?? ride?.client_label ?? "—"} />
          <Row label="E-mail" value={person(clientId)?.email ?? "—"} />
          <Row label="Téléphone" value={person(clientId)?.phone ?? "—"} />
        </Section>
        <Section title="Chauffeur">
          <Row label="Nom" value={person(driverId)?.full_name ?? "—"} />
          <Row label="E-mail" value={person(driverId)?.email ?? "—"} />
          <Row label="Téléphone" value={person(driverId)?.phone ?? "—"} />
        </Section>
      </div>

      <Section title="Options de la course">
        <Row label="Passagers" value={ride?.passengers ?? request?.passengers ?? "—"} />
        <Row label="Bagages" value={request?.luggage ?? "—"} />
        <Row label="Aller-retour" value={request?.round_trip ? "Oui" : "Non"} />
        <Row label="Besoins spécifiques" value={request?.special_needs ?? "—"} />
        <Row label="Commentaire client" value={request?.comment ?? "—"} />
      </Section>

      <Section title="Tarif et paiement">
        <Row
          label="Montant"
          value={
            ride?.amount_ttc != null
              ? formatEuro(Number(ride.amount_ttc))
              : ride?.price != null
                ? formatEuro(Number(ride.price))
                : request?.amount_ttc != null
                  ? formatEuro(Number(request.amount_ttc))
                  : "—"
          }
        />
        <Row label="Moyen de paiement" value={ride?.payment_method ?? "—"} />
        <Row
          label="Facture"
          value={
            invoice ? `${invoice.number} · ${INVOICE_LABELS[invoice.status] ?? invoice.status}` : "Aucune facture"
          }
        />
        {status === "cancelled" ? (
          <Row label="Comptabilisation" value="Course annulée : aucun chiffre d'affaires" />
        ) : null}
      </Section>

      {status === "cancelled" || ride?.cancelled_at ? (
        <Section title="Annulation">
          <Row
            label="Annulée le"
            value={ride?.cancelled_at ? formatDateTime(ride.cancelled_at) : "—"}
          />
          <Row
            label="Origine"
            value={
              (ride as { cancelled_by_role?: string | null } | null)?.cancelled_by_role === "admin"
                ? "Administration ReLink"
                : "Client ou chauffeur"
            }
          />
          <Row
            label="Motif"
            value={
              adminCancelReasonLabel(ride?.cancellation_reason ?? request?.cancellation_reason ?? null) ?? "—"
            }
          />
          <Row
            label="Commentaire interne"
            value={
              (ride as { admin_cancellation_comment?: string | null } | null)?.admin_cancellation_comment ??
              (request as { admin_cancellation_comment?: string | null } | null)?.admin_cancellation_comment ??
              "—"
            }
          />
          <Row
            label="Statut précédent"
            value={
              (ride as { previous_status?: string | null } | null)?.previous_status ??
              (request as { previous_status?: string | null } | null)?.previous_status ??
              "—"
            }
          />
        </Section>
      ) : null}

      <Section title="Chronologie">
        {!q.data?.history.length ? (
          <p className="text-sm text-muted-foreground">Aucun changement enregistré.</p>
        ) : (
          <ol className="space-y-2">
            {q.data.history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{RIDE_STATUS_LABELS[h.status] ?? h.status}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Journal administratif">
        {!q.data?.logs.length ? (
          <p className="text-sm text-muted-foreground">Aucune intervention enregistrée.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {q.data.logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3">
                <span>
                  {l.action}
                  {l.reason ? ` · ${adminCancelReasonLabel(l.reason)}` : ""}
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(l.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="size-4 text-destructive" /> Gestion administrative de la course
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {active
            ? "L'annulation interrompt la course dans ReLink pour le client et le chauffeur, et reste tracée dans l'historique."
            : "Cette course n'est plus active : aucune annulation administrative n'est possible."}
        </p>
        <Button
          className="mt-3"
          variant="destructive"
          disabled={!active}
          onClick={() => setCancelOpen(true)}
        >
          <Ban className="size-4" /> Interrompre et annuler la course
        </Button>
      </section>

      <AdminCancelRideDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        rideId={ride?.id ?? request!.id}
        status={status}
        onCancelled={() => void navigate({ to: "/admin/courses" })}
      />
    </div>
  );
}
