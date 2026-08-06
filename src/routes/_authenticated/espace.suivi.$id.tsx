import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RIDE_STATUS_LABELS, formatDateTime, formatEuro } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/espace/suivi/$id")({
  head: () => ({
    meta: [
      { title: "Course en cours — Relink" },
      {
        name: "description",
        content:
          "Suivez en temps réel l'avancée de votre course Relink : confirmation du chauffeur, approche, prise en charge et arrivée.",
      },
      { property: "og:title", content: "Course en cours — Relink" },
      {
        property: "og:description",
        content: "Suivi étape par étape de votre trajet et évaluation à l'arrivée.",
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
    match: ["new", "reviewing", "proposal_sent", "awaiting_client"],
  },
  {
    key: "accepted",
    title: "Chauffeur a accepté",
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
    title: "En course",
    hint: "Vous êtes à bord, bonne route.",
    match: ["client_onboard", "in_progress"],
  },
  {
    key: "done",
    title: "Arrivé à destination",
    hint: "Trajet terminé.",
    match: ["completed"],
  },
];

function stepIndex(status: string) {
  const i = STEPS.findIndex((s) => s.match.includes(status));
  return i;
}

function TrackingPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["client-tracking", id, user?.id],
    enabled: !!user?.id,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data: ride } = await supabase
        .from("rides")
        .select("*")
        .eq("id", id)
        .eq("client_id", user!.id)
        .maybeSingle();

      if (ride) {
        const [{ data: driver }, { data: review }, { data: invoice }] = await Promise.all([
          supabase.from("profiles").select("full_name, avatar_url").eq("id", ride.driver_id).maybeSingle(),
          supabase.from("ride_reviews").select("*").eq("ride_id", ride.id).maybeSingle(),
          supabase.from("invoices").select("*").eq("ride_id", ride.id).maybeSingle(),
        ]);
        return { kind: "ride" as const, ride, request: null, driver, review, invoice };
      }


      const { data: request } = await supabase
        .from("ride_requests")
        .select("*")
        .eq("id", id)
        .eq("client_id", user!.id)
        .maybeSingle();
      if (!request) return null;

      const [{ data: driver }, { data: linked }] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url").eq("id", request.driver_id).maybeSingle(),
        supabase.from("rides").select("*").eq("request_id", request.id).maybeSingle(),
      ]);
      return { kind: "request" as const, ride: linked ?? null, request, driver, review: null };
    },
  });

  const lastStatus = useRef<string | null>(null);
  const currentStatus = q.data?.ride?.status ?? q.data?.request?.status ?? null;

  // Notifie le client quand le chauffeur fait avancer la course
  useEffect(() => {
    if (!currentStatus) return;
    if (lastStatus.current && lastStatus.current !== currentStatus) {
      const label = RIDE_STATUS_LABELS[currentStatus] ?? currentStatus;
      const step = STEPS.find((s) => s.match.includes(currentStatus));
      toast.info(step?.title ?? label, { description: step?.hint ?? "Statut mis à jour." });
    }
    lastStatus.current = currentStatus;
  }, [currentStatus]);

  // Mise à jour en direct depuis le chauffeur
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


  if (q.isLoading) {
    return <div className="surface h-64 animate-pulse rounded-2xl" />;
  }

  if (!q.data) {
    return (
      <>
        <Header />
        <EmptyState title="Course introuvable" description="Cette course n'existe pas ou ne vous appartient pas." />
      </>
    );
  }

  const { ride, request, driver, review } = q.data;
  const status = ride?.status ?? request?.status ?? "new";
  const pickup = ride?.pickup_address ?? request!.pickup_address;
  const dropoff = ride?.dropoff_address ?? request!.dropoff_address;
  const scheduled = ride?.scheduled_at ?? request!.scheduled_at;
  const passengers = ride?.passengers ?? request?.passengers ?? 1;
  const price = ride?.price ?? request?.proposed_price ?? null;
  const cancelled = ["cancelled", "refused"].includes(status);
  const current = stepIndex(status);
  const completed = status === "completed";
  const pending =
    !ride && !!request && ["new", "reviewing", "proposal_sent", "awaiting_client"].includes(status);

  async function cancelRequest() {
    if (!request) return;
    setBusy(true);
    const { error } = await supabase
      .from("ride_requests")
      .update({ status: "cancelled" })
      .eq("id", request.id)
      .eq("client_id", user!.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Demande annulée");
    void qc.invalidateQueries({ queryKey: ["client-tracking", id] });
    void qc.invalidateQueries({ queryKey: ["client-home"] });
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

  return (
    <div className="pb-8">
      <Header />

      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {completed ? "Course terminée" : cancelled ? "Course annulée" : "Course en cours"}
            </p>
            <h1 className="mt-1 text-xl font-bold">
              {STEPS[current]?.title ?? RIDE_STATUS_LABELS[status] ?? status}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {cancelled
                ? "Cette demande n'ira pas plus loin."
                : (STEPS[current]?.hint ?? "En attente de confirmation du chauffeur.")}
            </p>
          </div>
          <StatusBadge status={status} labels={RIDE_STATUS_LABELS} />
        </div>

        {driver ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-muted p-3">
            <div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary">
              {driver.avatar_url ? (
                <img src={driver.avatar_url} alt={driver.full_name} className="size-full object-cover" />
              ) : (
                (driver.full_name?.[0] ?? "?").toUpperCase()
              )}
            </div>
            <div>
              <p className="text-sm font-semibold">{driver.full_name}</p>
              <p className="text-xs text-muted-foreground">Votre chauffeur</p>
            </div>
          </div>
        ) : null}
      </div>

      {pending ? (
        <div className="mt-4 flex flex-col items-center gap-4 rounded-3xl border border-primary/30 bg-primary/5 p-6 text-center">
          <span className="relative flex size-16 items-center justify-center">
            <span className="absolute inline-flex size-16 animate-ping rounded-full bg-primary/25" />
            <span className="relative grid size-14 place-items-center rounded-full bg-primary/15">
              <Loader2 className="size-7 animate-spin text-primary" />
            </span>
          </span>
          <div>
            <p className="text-sm font-semibold">En attente du chauffeur…</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {driver?.full_name ?? "Votre chauffeur"} doit confirmer votre course. Vous pouvez encore annuler.
            </p>
          </div>
          <Button
            variant="outline"
            className="h-11 w-full rounded-2xl font-semibold text-destructive"
            disabled={busy}
            onClick={cancelRequest}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
            Annuler ma demande
          </Button>
        </div>
      ) : null}



      {!cancelled ? (
        <ol className="mt-4 rounded-3xl border border-border bg-card p-5">
          {STEPS.map((s, i) => {
            const done = current > i;
            const active = current === i;
            return (
              <li key={s.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="size-4" /> : i + 1}
                  </span>
                  {i < STEPS.length - 1 ? (
                    <span className={`my-1 w-px flex-1 ${done ? "bg-primary" : "bg-border"}`} />
                  ) : null}
                </div>
                <div className={`pb-5 ${i === STEPS.length - 1 ? "pb-0" : ""}`}>
                  <p className={`text-sm font-semibold ${active || done ? "" : "text-muted-foreground"}`}>
                    {s.title}
                  </p>
                  {active ? <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="mt-4 rounded-3xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="mt-1.5 block size-3 shrink-0 rounded-full bg-primary" />
          <p className="text-sm font-medium">{pickup}</p>
        </div>
        <div className="my-1 ml-[6px] h-4 border-l border-dashed border-border" />
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          <p className="text-sm font-medium">{dropoff}</p>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-y-2 border-t border-border pt-4 text-sm">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4" /> Départ prévu
          </dt>
          <dd className="text-right font-medium">{formatDateTime(scheduled)}</dd>
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" /> Passagers
          </dt>
          <dd className="text-right font-medium">{passengers}</dd>
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Euro className="size-4" /> Prix
          </dt>
          <dd className="text-right font-medium">{price ? formatEuro(Number(price)) : "À confirmer"}</dd>
        </dl>

        {request?.driver_message ? (
          <p className="mt-3 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
            « {request.driver_message} »
          </p>
        ) : null}
      </div>

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
                {busy ? <Loader2 className="size-4 animate-spin" /> : <StarIcon className="size-4" />}
                Envoyer mon évaluation
              </Button>
            </>
          )}
        </div>
      ) : null}

      {ride ? (
        <Button
          variant="outline"
          className="mt-4 h-12 w-full rounded-2xl"
          onClick={() => navigate({ to: "/espace/courses/$rideId", params: { rideId: ride.id } })}
        >
          Voir le détail complet
        </Button>
      ) : null}
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
