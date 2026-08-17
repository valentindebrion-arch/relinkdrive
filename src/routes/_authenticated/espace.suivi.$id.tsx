import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BadgeCheck,
  Car,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  Clock,
  Euro,
  Hourglass,
  Loader2,
  MapPin,
  Phone,
  Send,
  Star as StarIcon,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  BookingThemeScope,
  PoweredByRelink,
  useDriverBranding,
} from "@/components/BookingThemeScope";
import { EmptyState } from "@/components/Ui";
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
import { getRideDriverPhone } from "@/lib/ride-cancel.functions";
import { useSignedUrl } from "@/lib/storage";
import {
  CANCELLABLE_STATUSES,
  TRACKING_STEPS,
  trackingPresentation,
  trackingStepIndex,
  type TrackingStepKey,
  type TrackingTone,
} from "@/lib/tracking-status";
import { TrackingDecor } from "@/components/tracking/TrackingDecor";
import { StatusHeroCard } from "@/components/tracking/StatusHeroCard";
import { TrackingProgress } from "@/components/tracking/TrackingProgress";
import { TrackingRouteCard } from "@/components/tracking/TrackingRouteCard";
import { TrackingDriverCard } from "@/components/tracking/TrackingDriverCard";
import { TrackingInfoCard } from "@/components/tracking/TrackingInfoCard";
import { TrackingPriceCard } from "@/components/tracking/TrackingPriceCard";

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

// Les étapes et libellés sont centralisés dans src/lib/tracking-status.ts.
const STEPS = TRACKING_STEPS;
const CANCELLABLE = CANCELLABLE_STATUSES;
const stepIndex = trackingStepIndex;

const HERO_ICONS: Record<TrackingStepKey, typeof Send> = {
  requested: Send,
  waiting: Hourglass,
  accepted: BadgeCheck,
  enroute: Car,
  arrived: MapPin,
  onboard: Car,
  done: CheckCircle2,
};

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

  // Thème du chauffeur associé à cette demande / course.
  const owner = useQuery({
    queryKey: ["tracking-driver", id, user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: ride } = await supabase
        .from("rides")
        .select("driver_id")
        .eq("id", id)
        .eq("client_id", user!.id)
        .maybeSingle();
      if (ride?.driver_id) return ride.driver_id;
      const { data: request } = await supabase
        .from("ride_requests")
        .select("driver_id")
        .eq("id", id)
        .eq("client_id", user!.id)
        .maybeSingle();
      return request?.driver_id ?? null;
    },
  });
  const branding = useDriverBranding({ driverId: owner.data ?? null });

  return (
    <BookingThemeScope theme={branding.data?.themeId} className="min-h-full">
      <TrackingPageInner />
      <PoweredByRelink />
    </BookingThemeScope>
  );
}

function TrackingPageInner() {
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
          { data: history },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", ride.driver_id)
            .maybeSingle(),
          supabase
            .from("vehicles")
            .select("brand, model, photo_url")
            .eq("driver_id", ride.driver_id)
            .order("is_primary", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from("ride_reviews").select("*").eq("ride_id", ride.id).maybeSingle(),
          supabase.from("invoices").select("*").eq("ride_id", ride.id).maybeSingle(),
          ride.request_id
            ? supabase.from("ride_requests").select("*").eq("id", ride.request_id).maybeSingle()
            : Promise.resolve({ data: null }),
          supabase
            .from("ride_status_history")
            .select("status, created_at")
            .eq("ride_id", ride.id)
            .order("created_at", { ascending: true }),
        ]);
        return {
          kind: "ride" as const,
          ride,
          request,
          driver,
          vehicle,
          review,
          invoice,
          history: history ?? [],
        };
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
          .select("brand, model, photo_url")
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
        history: [] as { status: string; created_at: string }[],
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

  // Contact direct : le numéro n'est révélé qu'une fois la course acceptée,
  // et uniquement par le serveur (jamais lu côté client depuis la table).
  const activeRide = q.data?.ride ?? null;
  const phoneEligible =
    !!activeRide &&
    ["confirmed", "driver_enroute", "driver_arrived", "client_onboard", "in_progress"].includes(
      activeRide.status,
    );
  const fetchPhone = useServerFn(getRideDriverPhone);
  const phoneQuery = useQuery({
    queryKey: ["tracking-driver-phone", activeRide?.id],
    enabled: phoneEligible,
    staleTime: 5 * 60_000,
    queryFn: () => fetchPhone({ data: { rideId: activeRide!.id } }),
  });
  const vehiclePhoto = useSignedUrl(
    "vehicles",
    (q.data?.vehicle as { photo_url?: string | null } | null | undefined)?.photo_url ?? null,
  );

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
  const history = q.data.history ?? [];
  const status = ride?.status ?? request?.status ?? "new";
  const pickup = ride?.pickup_address ?? request!.pickup_address;
  const dropoff = ride?.dropoff_address ?? request!.dropoff_address;
  const scheduled = ride?.scheduled_at ?? request!.scheduled_at;
  const passengers = ride?.passengers ?? request?.passengers ?? 1;
  const luggage = request?.luggage ?? null;
  const price = ride?.price ?? request?.proposed_price ?? null;
  // Instantané fiscal figé à la création : jamais recalculé depuis le profil actuel du chauffeur.
  const taxSource = (ride ?? request) as
    | {
        tax_regime?: string | null;
        tax_vat_rate?: number | null;
        amount_ht?: number | null;
        vat_amount?: number | null;
        tax_legal_mention?: string | null;
      }
    | null
    | undefined;
  const taxLiable = taxSource?.tax_regime === "liable" && !!taxSource.tax_vat_rate;
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

  // Horodatage réel des étapes, issu de l'historique serveur (jamais estimé).
  const stepTimes: Partial<Record<TrackingStepKey, string | null>> = {};
  if (request?.created_at) stepTimes.requested = request.created_at;
  for (const entry of history) {
    const step = STEPS.find((s) => s.match.includes(entry.status));
    if (step && !stepTimes[step.key]) stepTimes[step.key] = entry.created_at;
  }
  if (ride?.started_at && !stepTimes.onboard) stepTimes.onboard = ride.started_at;
  if (ride?.completed_at && !stepTimes.done) stepTimes.done = ride.completed_at;

  const presentation = trackingPresentation(status, {
    driverName: driverFirst,
    cancelledByDriver: !!ride && ride.cancelled_by_role === "driver",
  });
  const heroTone: TrackingTone = presentation.tone;
  const HeroIcon =
    presentation.index >= 0 ? HERO_ICONS[STEPS[presentation.index]!.key] : CircleSlash;
  const updatedAt = ride?.updated_at ?? request?.updated_at ?? null;
  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;
  const paymentMethodLabel =
    (ride?.payment_method ?? request?.payment_method)
      ? (PAYMENT_METHODS[(ride?.payment_method ?? request?.payment_method) as string] ??
        "Autre moyen")
      : null;

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
    const publicDriverName = rawName && !/^relink$/i.test(rawName) ? rawName : "Chauffeur";
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
              <Euro className="size-4" />{" "}
              {paid ? "Montant payé" : taxLiable ? "Prix TTC" : "Total à payer"}
            </span>
            <span className="text-lg font-extrabold">
              {price ? formatEuro(Number(price)) : "Non défini"}
            </span>
          </div>
          {price ? (
            <dl className="mt-2 grid grid-cols-2 gap-y-1 text-[13px]">
              {taxLiable ? (
                <>
                  <dt className="text-muted-foreground">Montant HT</dt>
                  <dd className="text-right font-medium">
                    {formatEuro(Number(taxSource?.amount_ht ?? 0))}
                  </dd>
                  <dt className="text-muted-foreground">
                    TVA ({Number(taxSource?.tax_vat_rate)} %)
                  </dt>
                  <dd className="text-right font-medium">
                    {formatEuro(Number(taxSource?.vat_amount ?? 0))}
                  </dd>
                </>
              ) : (
                <>
                  <dt className="text-muted-foreground">TVA</dt>
                  <dd className="text-right font-medium">Non applicable</dd>
                </>
              )}
            </dl>
          ) : null}
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
    <div className="relative w-full max-w-full overflow-x-hidden pb-10">
      <TrackingDecor />
      <Header />

      <div className="space-y-4">
        {/* 1 — Statut : unique bloc prioritaire, jamais dupliqué ailleurs. */}
        <StatusHeroCard
          icon={HeroIcon}
          tone={heroTone}
          title={presentation.title}
          description={presentation.description}
          next={presentation.next}
          updatedAt={updatedLabel}
        >
          {waiting ? (
            <div className="mt-4 flex flex-col items-center gap-3 text-center">
              {countdown ? (
                <ExpiryRing msLeft={countdown.msLeft} label={countdown.label} size={96}>
                  <span className="grid size-[66px] place-items-center overflow-hidden rounded-full bg-card text-lg font-bold text-primary shadow-sm">
                    {driver?.avatar_url ? (
                      <img src={driver.avatar_url} alt="" className="size-full object-cover" />
                    ) : (
                      initials(driver?.full_name)
                    )}
                  </span>
                </ExpiryRing>
              ) : (
                <span className="relative grid size-20 place-items-center">
                  <span className="absolute size-20 rounded-full border-2 border-primary/25 motion-safe:animate-ping" />
                  <span className="relative grid size-14 place-items-center overflow-hidden rounded-full bg-card text-base font-bold text-primary shadow-sm">
                    {driver?.avatar_url ? (
                      <img src={driver.avatar_url} alt="" className="size-full object-cover" />
                    ) : (
                      initials(driver?.full_name)
                    )}
                  </span>
                </span>
              )}
              {countdown ? (
                <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                  Réponse attendue sous <span className="text-foreground">{countdown.label}</span>
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Vous pouvez quitter cette page : le statut se met à jour automatiquement.
              </p>
            </div>
          ) : null}
        </StatusHeroCard>

        {/* 2 — Action utile du moment, unique et pleine largeur. */}
        {phoneQuery.data?.phone && !completed ? (
          <Button asChild className="h-12 w-full rounded-2xl font-bold">
            <a href={`tel:${phoneQuery.data.phone}`}>
              <Phone className="size-4" />
              Appeler {driverFirst}
            </a>
          </Button>
        ) : null}

        {stopped ? (
          <div className="space-y-2">
            {!cancelled || presentation.stopped ? (
              <Button
                className="h-12 w-full rounded-2xl font-bold"
                onClick={() => navigate({ to: "/espace/demandes" })}
              >
                Faire une nouvelle demande
              </Button>
            ) : null}
            <Link
              to="/espace/courses"
              className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-border text-sm font-semibold hover:bg-muted/50"
            >
              Retour à mes courses
            </Link>
          </div>
        ) : null}

        {/* 3 — Progression compacte. */}
        {!stopped ? <TrackingProgress current={current} times={stepTimes} /> : null}

        {/* 4 — Chauffeur. */}
        {driver ? (
          <TrackingDriverCard
            name={driverFirst}
            avatarUrl={driver.avatar_url}
            vehicleLabel={vehicleLabel}
            vehiclePhotoUrl={vehiclePhoto.data ?? null}
            note={request?.driver_message ?? null}
          />
        ) : null}

        {/* 5 — Trajet. */}
        <TrackingRouteCard pickup={pickup} dropoff={dropoff} />

        {/* 6 — Informations de réservation. */}
        <TrackingInfoCard
          items={[
            {
              label: immediate ? "Prise en charge (immédiate)" : "Date et heure prévues",
              value: formatDateTime(scheduled),
            },
            { label: "Passagers", value: String(passengers) },
            ...(luggage != null ? [{ label: "Bagages", value: String(luggage) }] : []),
            ...(request
              ? [
                  {
                    label: "Type de trajet",
                    value: request.round_trip ? "Aller-retour" : "Aller simple",
                  },
                ]
              : []),
            ...(request?.special_needs
              ? [{ label: "Besoins particuliers", value: request.special_needs }]
              : []),
            ...(request?.comment
              ? [{ label: "Consignes au chauffeur", value: request.comment }]
              : []),
          ]}
          footer={
            ride ? (
              <button
                type="button"
                onClick={() =>
                  navigate({ to: "/espace/courses/$rideId", params: { rideId: ride.id } })
                }
                className="mt-3 inline-flex min-h-11 w-full items-center justify-between rounded-2xl border border-border px-4 text-sm font-semibold transition-colors duration-200 hover:bg-muted/50"
              >
                Voir tous les détails <ChevronRight className="size-4" />
              </button>
            ) : null
          }
        />

        {/* 7 — Prix final à régler au chauffeur. */}
        <TrackingPriceCard
          amount={price ? formatEuro(Number(price)) : null}
          paymentLabel={paymentMethodLabel}
          estimated={!ride && !taxLiable}
        />

        {ride && invoice ? (
          <div>
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

        {/* 8 — Annulation : action secondaire, jamais mise en avant. */}
        {canCancel ? (
          <button
            type="button"
            onClick={() => setAskCancel(true)}
            disabled={busy}
            className="block min-h-11 w-full text-center text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-destructive"
          >
            Annuler ma demande
          </button>
        ) : null}
      </div>

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
