import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Euro,
  Loader2,
  MapPin,
  Star as StarIcon,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { InvoiceDownloadCard } from "@/components/InvoiceDownloadCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PAYMENT_METHODS, RIDE_STATUS_LABELS, formatDateTime, formatEuro } from "@/lib/labels";
import { saveRequestDraft } from "@/lib/request-draft";
import { BLOCKING_QUERY_KEY } from "@/lib/immediate-request";
import { ExpiryRing, useCountdown, useExpiryEffect } from "@/components/ExpiryCountdown";

export const Route = createFileRoute("/_authenticated/espace/suivi/$id")({
  head: () => ({
    meta: [
      { title: "Suivi de ma demande — Relink" },
      {
        name: "description",
        content:
          "Suivez en temps réel l'avancée de votre course Relink : réponse du chauffeur, approche, prise en charge et arrivée.",
      },
      { property: "og:title", content: "Suivi de ma demande — Relink" },
      {
        property: "og:description",
        content: "Suivi étape par étape de votre demande et de votre trajet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackingPage,
});

const STEPS: { key: string; title: string; hint: string; match: string[] }[] = [
  {
    key: "requested",
    title: "Demande envoyée",
    hint: "Votre demande a bien été transmise au chauffeur.",
    match: ["new"],
  },
  {
    key: "waiting",
    title: "En attente de la réponse",
    hint: "Le chauffeur consulte votre demande.",
    match: ["reviewing", "proposal_sent", "awaiting_client"],
  },
  {
    key: "accepted",
    title: "Demande acceptée",
    hint: "Votre course est confirmée.",
    match: ["confirmed"],
  },
  {
    key: "enroute",
    title: "Chauffeur en route",
    hint: "Le chauffeur se dirige vers le point de départ.",
    match: ["driver_enroute"],
  },
  {
    key: "arrived",
    title: "Chauffeur arrivé",
    hint: "Le chauffeur vous attend au point de rendez-vous.",
    match: ["driver_arrived"],
  },
  {
    key: "onboard",
    title: "Course en cours",
    hint: "Vous êtes à bord, bonne route.",
    match: ["client_onboard", "in_progress"],
  },
  {
    key: "done",
    title: "Course terminée",
    hint: "Trajet terminé.",
    match: ["completed"],
  },
];

const CANCELLABLE = ["new", "reviewing", "proposal_sent", "awaiting_client"];

function stepIndex(status: string) {
  return STEPS.findIndex((s) => s.match.includes(status));
}

function firstName(full?: string | null) {
  const n = (full ?? "").trim().split(" ")[0];
  return n || "votre chauffeur";
}

function initials(full?: string | null) {
  return (full ?? "?").trim().charAt(0).toUpperCase() || "?";
}

function TrackingPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [askCancel, setAskCancel] = useState(false);

  const q = useQuery({
    queryKey: ["client-tracking", id, user?.id],
    enabled: !!user?.id,
    refetchInterval: 15000,
    queryFn: async () => {
      // La lecture est filtrée côté serveur (RLS + client_id) : une demande d'un
      // autre client ne peut jamais être ouverte, même en modifiant l'URL.
      const { data: ride } = await supabase
        .from("rides")
        .select("*")
        .eq("id", id)
        .eq("client_id", user!.id)
        .maybeSingle();

      if (ride) {
        const [
          { data: driver },
          { data: vehicle },
          { data: review },
          { data: invoice },
          { data: request },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", ride.driver_id)
            .maybeSingle(),
          supabase
            .from("vehicles")
            .select("brand, model")
            .eq("driver_id", ride.driver_id)
            .order("is_primary", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from("ride_reviews").select("*").eq("ride_id", ride.id).maybeSingle(),
          supabase.from("invoices").select("*").eq("ride_id", ride.id).maybeSingle(),
          ride.request_id
            ? supabase.from("ride_requests").select("*").eq("id", ride.request_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        return { kind: "ride" as const, ride, request, driver, vehicle, review, invoice };
      }

      const { data: request } = await supabase
        .from("ride_requests")
        .select("*")
        .eq("id", id)
        .eq("client_id", user!.id)
        .maybeSingle();
      if (!request) return null;

      const [{ data: driver }, { data: vehicle }, { data: linked }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", request.driver_id)
          .maybeSingle(),
        supabase
          .from("vehicles")
          .select("brand, model")
          .eq("driver_id", request.driver_id)
          .order("is_primary", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("rides").select("*").eq("request_id", request.id).maybeSingle(),
      ]);
      return {
        kind: "request" as const,
        ride: linked ?? null,
        request,
        driver,
        vehicle,
        review: null,
        invoice: null,
      };
    },
  });

  const lastStatus = useRef<string | null>(null);
  const currentStatus = q.data?.ride?.status ?? q.data?.request?.status ?? null;

  useEffect(() => {
    if (!currentStatus) return;
    if (lastStatus.current && lastStatus.current !== currentStatus) {
      const label = RIDE_STATUS_LABELS[currentStatus] ?? currentStatus;
      const step = STEPS.find((s) => s.match.includes(currentStatus));
      toast.info(step?.title ?? label, { description: step?.hint ?? "Statut mis à jour." });
      void qc.invalidateQueries({ queryKey: [BLOCKING_QUERY_KEY] });
    }
    lastStatus.current = currentStatus;
  }, [currentStatus, qc]);

  // Abonnement temps réel unique pour cette fiche.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`tracking-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides", filter: `client_id=eq.${user.id}` },
        () => void qc.invalidateQueries({ queryKey: ["client-tracking", id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_requests", filter: `client_id=eq.${user.id}` },
        () => void qc.invalidateQueries({ queryKey: ["client-tracking", id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, user?.id, qc]);

  // Compte à rebours de réponse (10 min) : l'échéance est celle du serveur.
  const trackedRequest = q.data?.request ?? null;
  const trackedRide = q.data?.ride ?? null;
  const deadlineIso =
    !trackedRide && trackedRequest?.is_immediate && CANCELLABLE.includes(trackedRequest.status)
      ? (trackedRequest.response_deadline ?? null)
      : null;
  const countdown = useCountdown(deadlineIso);
  const handleExpired = useCallback(() => {
    // Le serveur reste juge : on déclenche l'expiration puis on relit l'état réel.
    void supabase.rpc("get_blocking_immediate_request").then(() => {
      void qc.invalidateQueries({ queryKey: ["client-tracking", id] });
      void qc.invalidateQueries({ queryKey: [BLOCKING_QUERY_KEY] });
      void qc.invalidateQueries({ queryKey: ["client-home"] });
      void qc.invalidateQueries({ queryKey: ["client-rides"] });
    });
  }, [id, qc]);
  useExpiryEffect(deadlineIso, !!countdown?.expired, handleExpired);

  // Fiche publique du chauffeur (uniquement si le client lui est bien relié).
  const completedDriverId =
    q.data?.ride?.status === "completed" ? (q.data.ride.driver_id ?? null) : null;
  const driverPublic = useQuery({
    queryKey: ["connected-driver-slug", completedDriverId],
    enabled: !!completedDriverId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_connected_driver_profiles");
      const row = (data ?? []).find((d) => d.user_id === completedDriverId);
      return row ? { slug: row.slug, businessName: row.business_name } : null;
    },
  });

  if (q.isLoading) return <TrackingSkeleton />;

  if (!q.data) {
    return (
      <>
        <Header />
        <EmptyState
          title="Demande introuvable"
          description="Cette demande n'existe pas ou ne vous appartient pas."
        />
      </>
    );
  }

  const { ride, request, driver, vehicle, review, invoice } = q.data;
  const status = ride?.status ?? request?.status ?? "new";
  const pickup = ride?.pickup_address ?? request!.pickup_address;
  const dropoff = ride?.dropoff_address ?? request!.dropoff_address;
  const scheduled = ride?.scheduled_at ?? request!.scheduled_at;
  const passengers = ride?.passengers ?? request?.passengers ?? 1;
  const luggage = request?.luggage ?? null;
  const price = ride?.price ?? request?.proposed_price ?? null;
  const refused = status === "refused";
  const cancelled = status === "cancelled";
  const expired = status === "expired";
  const stopped = refused || cancelled || expired;
  const current = stepIndex(status);
  const completed = status === "completed";
  const waiting = !ride && !!request && CANCELLABLE.includes(status);
  const canCancel = !!request && !ride && CANCELLABLE.includes(request.status);
  const driverFirst = firstName(driver?.full_name);
  const vehicleLabel = vehicle ? [vehicle.brand, vehicle.model].filter(Boolean).join(" ") : null;
  const immediate = (request as { is_immediate?: boolean } | null)?.is_immediate ?? false;

  async function cancelRequest() {
    if (!request) return;
    setBusy(true);
    const { error } = await supabase.rpc("cancel_client_ride_request", { _request: request.id });
    setBusy(false);
    setAskCancel(false);
    if (error) {
      toast.error("Annulation impossible", { description: error.message });
      return;
    }
    toast.success("Demande annulée");
    void qc.invalidateQueries({ queryKey: ["client-tracking", id] });
    void qc.invalidateQueries({ queryKey: ["client-home"] });
    void qc.invalidateQueries({ queryKey: ["client-rides"] });
    void qc.invalidateQueries({ queryKey: [BLOCKING_QUERY_KEY] });
  }

  async function submitReview() {
    if (!ride || rating < 1) return;
    setBusy(true);
    const { error } = await supabase.from("ride_reviews").insert({
      ride_id: ride.id,
      client_id: user!.id,
      driver_id: ride.driver_id,
      rating,
      comment: comment.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Merci pour votre évaluation !");
    void qc.invalidateQueries({ queryKey: ["client-tracking", id] });
  }

  // ─── Course réellement terminée : page de détail compacte, sans encadré de
  // statut ni chronologie (les historiques restent stockés côté serveur).
  if (completed && ride) {
    const endLabel = ride.completed_at
      ? `Terminée le ${formatDateTime(ride.completed_at)}`
      : `Course du ${formatDateTime(scheduled)}`;
    const options: { label: string; value: string }[] = [
      { label: "Passagers", value: String(passengers) },
      ...(luggage != null ? [{ label: "Bagages", value: String(luggage) }] : []),
      ...(request
        ? [{ label: "Trajet", value: request.round_trip ? "Aller-retour" : "Aller simple" }]
        : []),
      ...(request?.special_needs
        ? [{ label: "Besoins particuliers", value: request.special_needs }]
        : []),
      ...(request?.comment ? [{ label: "Consignes au chauffeur", value: request.comment }] : []),
      ...(ride.notes ? [{ label: "Informations complémentaires", value: ride.notes }] : []),
    ];
    const paid = invoice?.status === "paid" || !!invoice?.paid_at;
    // Le nom public du chauffeur ne doit jamais être la marque Relink.
    const business = (driverPublic.data?.businessName ?? "").trim();
    const legal = (driver?.full_name ?? "").trim();
    const rawName = business || (/^relink$/i.test(legal) ? "" : firstName(legal));
    const publicDriverName = rawName && !/^relink$/i.test(rawName) ? rawName : "Votre chauffeur";
    const paymentLabel = ride.payment_method
      ? (PAYMENT_METHODS[ride.payment_method] ?? "Autre moyen")
      : null;

    return (
      <div className="pb-10">
        <Header />

        <header className="animate-fade-in">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight">Détail de la course</h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              Terminée
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{endLabel}</p>
        </header>

        {/* Votre trajet */}
        <section className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <p className="text-sm font-semibold">Votre trajet</p>
          <div className="mt-3 flex items-start gap-3">
            <span className="mt-1.5 block size-3 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Adresse de départ</p>
              <p className="text-sm font-medium break-words">{pickup}</p>
            </div>
          </div>
          <div className="my-1 ml-[6px] h-4 border-l border-dashed border-border" />
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Destination</p>
              <p className="text-sm font-medium break-words">{dropoff}</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-y-2 border-t border-border pt-4 text-sm">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-4" /> Date et heure
            </dt>
            <dd className="text-right font-medium">{formatDateTime(scheduled)}</dd>
            {ride.mileage_km != null ? (
              <>
                <dt className="text-muted-foreground">Distance parcourue</dt>
                <dd className="text-right font-medium">{Number(ride.mileage_km)} km</dd>
              </>
            ) : null}
            {ride.started_at && ride.completed_at ? (
              <>
                <dt className="text-muted-foreground">Durée du trajet</dt>
                <dd className="text-right font-medium">
                  {Math.max(
                    1,
                    Math.round(
                      (new Date(ride.completed_at).getTime() -
                        new Date(ride.started_at).getTime()) /
                        60_000,
                    ),
                  )}{" "}
                  min
                </dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Type de trajet</dt>
            <dd className="text-right font-medium">
              {request?.round_trip ? "Aller-retour" : "Aller simple"}
            </dd>
          </dl>
        </section>

        {/* Votre chauffeur */}
        {driver ? (
          <section className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
            <p className="text-sm font-semibold">Votre chauffeur</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary">
                {driver.avatar_url ? (
                  <img
                    src={driver.avatar_url}
                    alt={driverFirst}
                    className="size-full object-cover"
                  />
                ) : (
                  initials(driver.full_name)
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{publicDriverName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {vehicleLabel ?? "Chauffeur partenaire"}
                </span>
              </span>
            </div>
            {driverPublic.data?.slug ? (
              <Link
                to="/chauffeur/$slug"
                params={{ slug: driverPublic.data.slug }}
                className="mt-3 inline-flex w-full items-center justify-between rounded-2xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted/50"
              >
                Voir le profil du chauffeur <ChevronRight className="size-4" />
              </Link>
            ) : null}
          </section>
        ) : null}

        {/* Vos options */}
        <section className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <p className="text-sm font-semibold">Vos options</p>
          {options.length ? (
            <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
              {options.map((o) => (
                <div key={o.label} className="col-span-2 flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">{o.label}</dt>
                  <dd className="max-w-[60%] text-right font-medium break-words">{o.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Aucune option particulière</p>
          )}
        </section>

        {/* Tarif et paiement */}
        <section className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <p className="text-sm font-semibold">Tarif et paiement</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Euro className="size-4" /> {paid ? "Montant payé" : "Montant total"}
            </span>
            <span className="text-lg font-extrabold">
              {price ? formatEuro(Number(price)) : "Non défini"}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 border-t border-border pt-3 text-sm">
            <dt className="text-muted-foreground">État du paiement</dt>
            <dd className="text-right font-medium">
              {paid
                ? "Payée"
                : invoice
                  ? "En attente de règlement"
                  : "À régler auprès du chauffeur"}
            </dd>
            {paymentLabel ? (
              <>
                <dt className="text-muted-foreground">Moyen de paiement</dt>
                <dd className="text-right font-medium">{paymentLabel}</dd>
              </>
            ) : null}
            {invoice?.paid_at ? (
              <>
                <dt className="text-muted-foreground">Réglée le</dt>
                <dd className="text-right font-medium">{formatDateTime(invoice.paid_at)}</dd>
              </>
            ) : null}
          </dl>
        </section>

        {/* Reçu / facture */}
        {invoice ? (
          <div className="mt-4">
            <InvoiceDownloadCard
              invoice={invoice as never}
              driverId={ride.driver_id}
              ride={{
                pickup_address: ride.pickup_address,
                dropoff_address: ride.dropoff_address,
                scheduled_at: ride.scheduled_at,
                completed_at: ride.completed_at,
                passengers: ride.passengers,
                mileage_km: ride.mileage_km,
              }}
            />
            <p className="mt-2 px-1 text-[11px] leading-snug text-muted-foreground">
              Reçu généré avec Relink. La facture est émise par votre chauffeur indépendant, seul
              responsable de son contenu.
            </p>
          </div>
        ) : null}

        {/* Évaluation */}
        <section className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <p className="text-sm font-semibold">{review ? "Avis envoyé" : "Laisser un avis"}</p>
          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => {
              const value = review?.rating ?? rating;
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                  disabled={!!review}
                  onClick={() => setRating(n)}
                  className="transition-transform active:scale-90"
                >
                  <StarIcon
                    className={`size-8 ${n <= value ? "fill-warning text-warning" : "text-muted-foreground"}`}
                  />
                </button>
              );
            })}
          </div>
          {review ? (
            review.comment ? (
              <p className="mt-3 text-sm text-muted-foreground">« {review.comment} »</p>
            ) : null
          ) : (
            <>
              <Textarea
                className="mt-3 rounded-2xl"
                placeholder="Un mot sur votre trajet (facultatif)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Button
                className="mt-3 h-12 w-full rounded-2xl font-bold"
                disabled={rating < 1 || busy}
                onClick={submitReview}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <StarIcon className="size-4" />
                )}
                Envoyer mon évaluation
              </Button>
            </>
          )}
        </section>

        {/* Actions après la course */}
        <section className="mt-4 space-y-2">
          <Button
            className="h-12 w-full rounded-2xl font-bold"
            onClick={() => {
              saveRequestDraft({
                driver_id: ride.driver_id,
                pickup_address: ride.pickup_address,
                dropoff_address: ride.dropoff_address,
                scheduled_at: "",
                whenMode: "later",
                pickupOk: true,
                dropoffOk: true,
              });
              navigate({ to: "/espace/demandes" });
            }}
          >
            Réserver à nouveau
          </Button>
          <Link
            to="/aide"
            className="block w-full rounded-2xl border border-border px-4 py-3 text-center text-sm font-semibold hover:bg-muted/50"
          >
            Contacter l'assistance
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <Header />

      {/* En-tête */}
      <section className="animate-fade-in rounded-3xl border border-border bg-card p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight">
              {refused
                ? "Demande refusée"
                : cancelled
                  ? "Demande annulée"
                  : expired
                    ? "Demande expirée"
                    : completed
                      ? "Course terminée"
                      : waiting
                        ? "Demande envoyée"
                        : (STEPS[current]?.title ?? RIDE_STATUS_LABELS[status] ?? status)}
            </h1>
            <p className="mt-1 text-sm break-words text-muted-foreground">
              {refused
                ? `${driverFirst} n'est pas disponible pour cette demande.`
                : cancelled
                  ? "Cette demande a été annulée."
                  : expired
                    ? `${driverFirst} n'a pas répondu dans le délai de 10 minutes.`
                    : waiting
                      ? `Votre demande a été transmise à ${driverFirst}.`
                      : (STEPS[current]?.hint ?? "Statut mis à jour.")}
            </p>
          </div>
          <StatusBadge status={status} labels={RIDE_STATUS_LABELS} />
        </div>

        {driver ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-muted/70 p-3">
            <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary">
              {driver.avatar_url ? (
                <img src={driver.avatar_url} alt={driverFirst} className="size-full object-cover" />
              ) : (
                initials(driver.full_name)
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{driverFirst}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {vehicleLabel ? `Chauffeur · ${vehicleLabel}` : "Votre chauffeur"}
              </span>
            </span>
          </div>
        ) : null}
      </section>

      {/* Attente animée */}
      {waiting ? (
        <section className="mt-4 flex flex-col items-center gap-4 rounded-3xl border border-warning/30 bg-warning/[0.06] p-6 text-center">
          {countdown ? (
            <ExpiryRing msLeft={countdown.msLeft} label={countdown.label} size={104}>
              <span className="grid size-[72px] place-items-center overflow-hidden rounded-full bg-card text-lg font-bold text-primary shadow-sm">
                {driver?.avatar_url ? (
                  <img
                    src={driver.avatar_url}
                    alt={driverFirst}
                    className="size-full object-cover"
                  />
                ) : (
                  initials(driver?.full_name)
                )}
              </span>
            </ExpiryRing>
          ) : (
            <span className="relative grid size-24 place-items-center">
              <span className="absolute size-24 rounded-full border-2 border-primary/30 motion-safe:animate-ping" />
              <span className="absolute size-20 rounded-full border-2 border-primary/50 motion-safe:animate-pulse" />
              <span className="relative grid size-16 place-items-center overflow-hidden rounded-full bg-card text-lg font-bold text-primary shadow-sm">
                {driver?.avatar_url ? (
                  <img
                    src={driver.avatar_url}
                    alt={driverFirst}
                    className="size-full object-cover"
                  />
                ) : (
                  initials(driver?.full_name)
                )}
              </span>
            </span>
          )}
          {countdown ? (
            <p className="-mt-2 text-xs font-semibold tabular-nums text-muted-foreground">
              Réponse attendue sous <span className="text-foreground">{countdown.label}</span>
            </p>
          ) : null}
          <div>
            <p className="flex items-center justify-center gap-1 text-sm font-semibold">
              En attente de la réponse du chauffeur
              <span aria-hidden className="inline-flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1 rounded-full bg-primary motion-safe:animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Vous pouvez quitter cette page. Le statut sera actualisé automatiquement.
            </p>
          </div>
        </section>
      ) : null}

      {/* Expiration après 10 minutes sans réponse */}
      {expired ? (
        <section className="animate-fade-in mt-4 rounded-3xl border border-destructive/25 bg-destructive/[0.05] p-5 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
            <Clock className="size-5" />
          </span>
          <p className="mt-3 text-sm font-semibold">Demande expirée</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {driverFirst} n'a pas répondu dans les 10 minutes. Vous pouvez relancer une demande,
            avec le même chauffeur ou un autre.
          </p>
          <Button
            className="mt-4 h-11 w-full rounded-2xl font-semibold"
            onClick={() => navigate({ to: "/espace/demandes" })}
          >
            Faire une nouvelle demande
          </Button>
          <Link
            to="/espace/courses"
            className="mt-2 block text-center text-sm font-medium text-muted-foreground underline underline-offset-4"
          >
            Retour à mes courses
          </Link>
        </section>
      ) : null}

      {/* Refus */}
      {refused ? (
        <section className="mt-4 rounded-3xl border border-destructive/25 bg-destructive/[0.05] p-5">
          <p className="text-sm font-semibold">
            Le chauffeur n'est pas disponible pour cette demande
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Vous pouvez choisir un autre chauffeur et envoyer une nouvelle demande.
          </p>
          <Button
            className="mt-3 h-11 w-full rounded-2xl font-semibold"
            onClick={() => navigate({ to: "/espace/demandes" })}
          >
            Choisir un autre chauffeur
          </Button>
          <Link
            to="/espace/courses"
            className="mt-2 block text-center text-sm font-medium text-muted-foreground underline underline-offset-4"
          >
            Retour à mes courses
          </Link>
        </section>
      ) : null}

      {/* Acceptation */}
      {ride && !completed && !cancelled ? (
        <section className="animate-fade-in mt-4 flex items-center gap-3 rounded-3xl border border-primary/30 bg-primary/[0.05] p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <Check className="size-4" />
          </span>
          <p className="min-w-0 text-sm font-semibold">Votre chauffeur a accepté la demande</p>
        </section>
      ) : null}

      {/* Chronologie */}
      {!stopped ? (
        <ol className="mt-4 rounded-3xl border border-border bg-card p-5">
          {STEPS.map((s, i) => {
            const done = current > i;
            const active = current === i;
            return (
              <li key={s.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold transition-colors ${
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : active
                          ? "border-primary bg-primary/10 text-primary motion-safe:animate-pulse"
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="size-4" /> : i + 1}
                  </span>
                  {i < STEPS.length - 1 ? (
                    <span className={`my-1 w-px flex-1 ${done ? "bg-primary" : "bg-border"}`} />
                  ) : null}
                </div>
                <div className={i === STEPS.length - 1 ? "" : "pb-5"}>
                  <p
                    className={`text-sm ${active ? "font-bold" : done ? "font-medium" : "text-muted-foreground"}`}
                  >
                    {s.title}
                  </p>
                  {active ? <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      {/* Résumé de la demande */}
      <section className="mt-4 rounded-3xl border border-border bg-card p-5">
        <p className="text-sm font-semibold">Votre demande</p>

        <div className="mt-3 flex items-start gap-3">
          <span className="mt-1.5 block size-3 shrink-0 rounded-full bg-primary" />
          <p className="text-sm font-medium break-words">{pickup}</p>
        </div>
        <div className="my-1 ml-[6px] h-4 border-l border-dashed border-border" />
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-sm font-medium break-words">{dropoff}</p>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-y-2 border-t border-border pt-4 text-sm">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4" /> {immediate ? "Maintenant" : "Planifiée"}
          </dt>
          <dd className="text-right font-medium">{formatDateTime(scheduled)}</dd>
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" /> Passagers
          </dt>
          <dd className="text-right font-medium">{passengers}</dd>
          {luggage != null ? (
            <>
              <dt className="text-muted-foreground">Bagages</dt>
              <dd className="text-right font-medium">{luggage}</dd>
            </>
          ) : null}
          {request ? (
            <>
              <dt className="text-muted-foreground">Trajet</dt>
              <dd className="text-right font-medium">
                {request.round_trip ? "Aller-retour" : "Aller simple"}
              </dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Chauffeur</dt>
          <dd className="text-right font-medium">{driverFirst}</dd>
          {vehicleLabel ? (
            <>
              <dt className="text-muted-foreground">Véhicule</dt>
              <dd className="text-right font-medium">{vehicleLabel}</dd>
            </>
          ) : null}
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Euro className="size-4" /> Prix
          </dt>
          <dd className="text-right font-medium">
            {price ? formatEuro(Number(price)) : "À confirmer"}
          </dd>
          {request?.special_needs ? (
            <>
              <dt className="text-muted-foreground">Besoins particuliers</dt>
              <dd className="text-right font-medium break-words">{request.special_needs}</dd>
            </>
          ) : null}
        </dl>

        {request?.driver_message ? (
          <p className="mt-3 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
            « {request.driver_message} »
          </p>
        ) : null}

        {ride ? (
          <button
            type="button"
            onClick={() => navigate({ to: "/espace/courses/$rideId", params: { rideId: ride.id } })}
            className="mt-4 inline-flex w-full items-center justify-between rounded-2xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted/50"
          >
            Voir tous les détails <ChevronRight className="size-4" />
          </button>
        ) : null}
      </section>

      {/* Évaluation */}
      {completed && ride ? (
        <div className="mt-4 rounded-3xl border border-border bg-card p-5">
          <p className="text-sm font-semibold">
            {review ? "Votre évaluation" : "Évaluer ce trajet"}
          </p>
          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => {
              const value = review?.rating ?? rating;
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                  disabled={!!review}
                  onClick={() => setRating(n)}
                  className="transition-transform active:scale-90"
                >
                  <StarIcon
                    className={`size-8 ${n <= value ? "fill-warning text-warning" : "text-muted-foreground"}`}
                  />
                </button>
              );
            })}
          </div>
          {review ? (
            review.comment ? (
              <p className="mt-3 text-sm text-muted-foreground">« {review.comment} »</p>
            ) : null
          ) : (
            <>
              <Textarea
                className="mt-3 rounded-2xl"
                placeholder="Un mot sur votre trajet (facultatif)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Button
                className="mt-3 h-12 w-full rounded-2xl font-bold"
                disabled={rating < 1 || busy}
                onClick={submitReview}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <StarIcon className="size-4" />
                )}
                Envoyer mon évaluation
              </Button>
            </>
          )}
        </div>
      ) : null}

      {ride && invoice ? (
        <div className="mt-4">
          <InvoiceDownloadCard
            invoice={invoice as never}
            driverId={ride.driver_id}
            ride={{
              pickup_address: ride.pickup_address,
              dropoff_address: ride.dropoff_address,
              scheduled_at: ride.scheduled_at,
              completed_at: ride.completed_at,
              passengers: ride.passengers,
              mileage_km: ride.mileage_km,
            }}
          />
          <p className="mt-2 px-1 text-[11px] leading-snug text-muted-foreground">
            Reçu généré avec Relink. La facture est émise par votre chauffeur indépendant, seul
            responsable de son contenu.
          </p>
        </div>
      ) : null}

      {/* Annulation : action secondaire discrète */}
      {canCancel ? (
        <button
          type="button"
          onClick={() => setAskCancel(true)}
          disabled={busy}
          className="mt-5 block w-full text-center text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-destructive"
        >
          Annuler ma demande
        </button>
      ) : null}

      <AlertDialog open={askCancel} onOpenChange={setAskCancel}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cette demande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le chauffeur ne recevra plus votre demande. Tant qu'aucune course n'est confirmée,
              l'annulation est sans frais. Vous pourrez ensuite envoyer une nouvelle demande.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conserver ma demande</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void cancelRequest();
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              Confirmer l'annulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TrackingSkeleton() {
  return (
    <div className="pb-10">
      <Header />
      <div className="h-36 animate-pulse rounded-3xl bg-muted" />
      <div className="mt-4 h-48 animate-pulse rounded-3xl bg-muted" />
      <div className="mt-4 h-64 animate-pulse rounded-3xl bg-muted" />
    </div>
  );
}

function Header() {
  return (
    <Link
      to="/espace/courses"
      className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Mes courses
    </Link>
  );
}
