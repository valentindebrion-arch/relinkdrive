import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  LocateFixed,
  Luggage,
  MapPin,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime, formatEuro } from "@/lib/labels";
import { LiveDriversMap } from "@/components/LiveDriversMap";
import { RouteMiniMap } from "@/components/RouteMiniMap";
import { AddressSearchPanel, pushRecentAddress } from "@/components/request/AddressSearchPanel";
import {
  OptionsStep,
  serializeNeeds,
  type ReturnMode,
  type SpecialNeedsState,
} from "@/components/request/OptionsStep";
import { estimateRoute, reverseGeocode } from "@/lib/route-estimate.functions";
import { checkDriverAvailability } from "@/lib/availability.functions";
import {
  SAFETY_MARGIN_MIN,
  availabilityMessage,
  formatSlot,
  type AvailabilityResult,
} from "@/lib/availability";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { cn } from "@/lib/utils";

const searchSchema = z.object({ driver: z.string().optional() });

export const Route = createFileRoute("/_authenticated/espace/demandes")({
  validateSearch: searchSchema,
  component: ClientRequests,
});

type Estimate = {
  distanceKm: number;
  durationMin: number;
  polyline: string;
  price: { base: number; total: number; tip: number };
};

const STEP_LABELS = ["Votre trajet", "Vos options", "Récapitulatif", "Confirmation"];

const TRIP_TYPES = [
  "Aéroport",
  "Gare",
  "Événement",
  "Trajet urbain",
  "Longue distance",
  "Mise à disposition",
  "Autre",
] as const;

const HEADINGS = [
  {
    title: "Préparons votre trajet",
    sub: "Indiquez où votre chauffeur doit vous récupérer et où vous souhaitez aller.",
  },
  { title: "Vos options", sub: "Passagers, bagages et précisions pour le chauffeur." },
  { title: "Votre récapitulatif", sub: "Vérifiez l'itinéraire et le tarif estimé." },
  { title: "Confirmer la demande", sub: "Elle sera transmise à votre chauffeur." },
];

/** Progression minimaliste : « Étape n sur 4 » + barre fine. */
function StepProgress({ step }: { step: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
          Étape {step + 1} sur {STEP_LABELS.length}
        </p>
        <p className="text-[13px] font-semibold text-primary">{STEP_LABELS[step]}</p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[13px] font-bold">{children}</p>;
}

function ClientRequests() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const estimateFn = useServerFn(estimateRoute);
  const geocodeFn = useServerFn(reverseGeocode);
  const availabilityFn = useServerFn(checkDriverAvailability);

  const [step, setStepRaw] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const setStep = (n: number) => {
    setDir(n >= step ? 1 : -1);
    setStepRaw(n);
  };
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pickupOk, setPickupOk] = useState(false);
  const [dropoffOk, setDropoffOk] = useState(false);
  const [whenMode, setWhenMode] = useState<"now" | "later">("now");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [checking, setChecking] = useState(false);
  const [avail, setAvail] = useState<AvailabilityResult | null>(null);
  const [alternatives, setAlternatives] = useState<AvailabilityResult[] | null>(null);
  const [searchField, setSearchField] = useState<"pickup" | "dropoff" | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [preview, setPreview] = useState<{
    distanceKm: number;
    durationMin: number;
    polyline: string;
  } | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "error">("idle");
  const [showPreviewMap, setShowPreviewMap] = useState(false);
  const [needs, setNeeds] = useState<SpecialNeedsState>({ keys: [], details: {} });
  const [returnMode, setReturnMode] = useState<ReturnMode>("immediate");
  const [returnTrip, setReturnTrip] = useState({ at: "", pickup: "", dropoff: "" });

  const [form, setForm] = useState({
    driver_id: search.driver ?? "",
    pickup_address: "",
    dropoff_address: "",
    scheduled_at: "",
    passengers: "1",
    luggage: "0",
    comment: "",
    special_needs: "",
    round_trip: false,
    trip_type: "",
  });

  // Toute modification pertinente invalide la vérification de créneau.
  useEffect(() => {
    setAvail(null);
    setAlternatives(null);
  }, [form.driver_id, form.pickup_address, form.dropoff_address, form.scheduled_at, whenMode]);

  // Aperçu d'itinéraire dès que départ et arrivée sont confirmés (étape 1).
  useEffect(() => {
    if (!pickupOk || !dropoffOk || !form.pickup_address || !form.dropoff_address) {
      setPreview(null);
      setPreviewState("idle");
      return;
    }
    let cancelled = false;
    setPreviewState("loading");
    void (async () => {
      try {
        const res = (await estimateFn({
          data: { origin: form.pickup_address, destination: form.dropoff_address },
        })) as Estimate;
        if (cancelled) return;
        setPreview({
          distanceKm: res.distanceKm,
          durationMin: res.durationMin,
          polyline: res.polyline,
        });
        setEstimate(res);
        setPreviewState("idle");
      } catch {
        if (cancelled) return;
        setPreview(null);
        setPreviewState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickupOk, dropoffOk, form.pickup_address, form.dropoff_address, estimateFn]);

  const drivers = useQuery({
    queryKey: ["client-driver-options", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: conns } = await supabase
        .from("driver_client_connections")
        .select("driver_id")
        .eq("client_id", user!.id);
      const ids = (conns ?? []).map((c) => c.driver_id);
      if (!ids.length) return [];
      const [{ data }, { data: dprofiles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", ids),
        supabase.rpc("get_connected_driver_profiles"),
      ]);
      return (data ?? []).map((p) => ({
        ...p,
        on_duty: (dprofiles ?? []).find((d) => d.user_id === p.id)?.on_duty ?? false,
      }));
    },
  });

  function scheduledIso() {
    return whenMode === "now"
      ? new Date(Date.now() + 10 * 60_000).toISOString()
      : new Date(form.scheduled_at).toISOString();
  }

  async function fillMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Localisation indisponible sur cet appareil");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await geocodeFn({
            data: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          });
          setForm((f) => ({ ...f, pickup_address: res.address }));
          setPickupOk(true);
          setEstimate(null);
          toast.success("Adresse de départ confirmée");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Adresse introuvable");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.error("Autorisez la localisation pour utiliser cette option");
      },
    );
  }

  async function computeEstimate() {
    setBusy(true);
    try {
      const res = await estimateFn({
        data: { origin: form.pickup_address.trim(), destination: form.dropoff_address.trim() },
      });
      const multiplier = form.round_trip ? 2 : 1;
      setEstimate({
        distanceKm: Math.round(res.distanceKm * multiplier * 10) / 10,
        durationMin: res.durationMin * multiplier,
        polyline: res.polyline,
        price: form.round_trip
          ? {
              base: Math.round(res.price.base * 2 * 100) / 100,
              total: Math.ceil(res.price.base * 2),
              tip: Math.round((Math.ceil(res.price.base * 2) - res.price.base * 2) * 100) / 100,
            }
          : res.price,
      });
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Estimation impossible");
    } finally {
      setBusy(false);
    }
  }

  function toLocalInput(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** Vérifie la faisabilité réelle du créneau (course précédente, suivante, marge). */
  async function runCheck(driverIds: string[], iso: string) {
    return availabilityFn({
      data: {
        driverIds,
        pickup: form.pickup_address.trim(),
        dropoff: form.dropoff_address.trim(),
        desiredIso: iso,
      },
    });
  }

  async function checkSelectedDriver() {
    setChecking(true);
    setAlternatives(null);
    try {
      const res = await runCheck([form.driver_id], scheduledIso());
      const verdict = res.results[0] ?? null;
      setAvail(verdict);
      return verdict;
    } catch (e) {
      console.error(e);
      setAvail({
        driverId: form.driver_id,
        status: "unknown",
        earliestIso: null,
        repositionMin: null,
        tripMin: null,
        marginMin: SAFETY_MARGIN_MIN,
        reason: "erreur_verification",
      });
      return null;
    } finally {
      setChecking(false);
    }
  }

  async function findOtherDrivers() {
    const ids = (drivers.data ?? []).map((d) => d.id).filter((id) => id !== form.driver_id);
    if (!ids.length) {
      toast.info("Aucun autre chauffeur dans votre carnet");
      return;
    }
    setChecking(true);
    try {
      const res = await runCheck(ids.slice(0, 8), scheduledIso());
      setAlternatives(res.results);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vérification impossible");
    } finally {
      setChecking(false);
    }
  }

  async function next() {
    if (step === 0) {
      if (!form.driver_id) return toast.error("Choisissez un chauffeur");
      if (whenMode === "now" && !driverAvailable)
        return toast.error("Ce chauffeur est indisponible", {
          description: "Réservez pour plus tard.",
        });
      if (!pickupOk) return toast.error("Confirmez l'adresse de départ dans la liste proposée");
      if (!dropoffOk) return toast.error("Confirmez l'adresse d'arrivée dans la liste proposée");
      if (whenMode === "later" && !form.scheduled_at)
        return toast.error("Choisissez une date et une heure");
      const verdict = avail?.status === "available" ? avail : await checkSelectedDriver();
      if (!verdict || verdict.status !== "available") return;
      setEstimate(null);
      return setStep(1);
    }
    if (step === 1) return void computeEstimate();
    if (step === 2) return setStep(3);
  }

  function resetForm() {
    setForm((f) => ({
      ...f,
      pickup_address: "",
      dropoff_address: "",
      scheduled_at: "",
      comment: "",
      special_needs: "",
    }));
    setPickupOk(false);
    setDropoffOk(false);
    setWhenMode("now");
    setEstimate(null);
    setStep(0);
  }

  async function submit() {
    setBusy(true);
    // Vérification finale avec les données les plus récentes (anti-conflit).
    try {
      const res = await availabilityFn({
        data: {
          driverIds: [form.driver_id],
          pickup: form.pickup_address.trim(),
          dropoff: form.dropoff_address.trim(),
          desiredIso: scheduledIso(),
        },
      });
      const verdict = res.results[0] ?? null;
      if (!verdict || verdict.status !== "available") {
        setBusy(false);
        setAvail(verdict);
        setStep(0);
        toast.error("Ce créneau n'est plus réalisable", {
          description: verdict ? availabilityMessage(verdict) : undefined,
        });
        return;
      }
    } catch {
      setBusy(false);
      toast.error("Vérification du créneau impossible", {
        description: "Réessayez dans un instant.",
      });
      return;
    }
    const estimateLine = estimate
      ? `Prix final Relink : ${formatEuro(estimate.price.total)} · ${estimate.distanceKm} km · ~${estimate.durationMin} min`
      : null;
    const returnLine = form.round_trip
      ? returnMode === "scheduled"
        ? `Retour planifié : ${returnTrip.at ? formatDateTime(new Date(returnTrip.at).toISOString()) : "—"} · ${returnTrip.pickup} → ${returnTrip.dropoff}`
        : "Retour immédiatement après la course"
      : null;
    const comment = [form.comment.trim(), returnLine, estimateLine].filter(Boolean).join("\n");

    const { data: created, error } = await supabase
      .from("ride_requests")
      .insert({
        client_id: user!.id,
        driver_id: form.driver_id,
        pickup_address: form.pickup_address.trim(),
        dropoff_address: form.dropoff_address.trim(),
        scheduled_at: scheduledIso(),
        passengers: Number(form.passengers),
        luggage: Number(form.luggage),
        comment: comment || null,
        special_needs: form.special_needs.trim() || null,
        round_trip: form.round_trip,
        trip_type: form.trip_type.trim() || null,
        proposed_price: estimate ? estimate.price.total : null,
        status: "new",
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      // Dernier rempart serveur : disponibilités déclarées du chauffeur.
      if (/disponible/i.test(error.message)) {
        setStep(0);
        toast.error("Ce chauffeur n'est pas disponible à la date ou à l'horaire sélectionné.", {
          description: "Modifiez la date ou l'heure, ou choisissez un autre chauffeur.",
        });
        return;
      }
      toast.error(error.message);
      return;
    }

    toast.success("Demande envoyée — en attente de confirmation du chauffeur");
    resetForm();
    navigate({ to: "/espace/suivi/$id", params: { id: created.id } });
  }
  const heading = HEADINGS[step]!;
  const selectedDriver = (drivers.data ?? []).find((d) => d.id === form.driver_id);
  const driverName = selectedDriver?.full_name;
  const driverAvailable = !!selectedDriver?.on_duty;

  const tripReady = pickupOk && dropoffOk;
  const dirty =
    !!form.pickup_address || !!form.dropoff_address || !!form.scheduled_at || !!form.comment;

  function leave() {
    if (dirty) return setExitOpen(true);
    navigate({ to: "/espace" });
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col overflow-hidden",
        step === 0 ? "bg-muted/40" : "bg-background",
      )}
    >
      <div className="relative flex shrink-0 items-center justify-center px-2 py-2">
        <button
          type="button"
          aria-label="Retour"
          className="absolute left-2 flex size-10 items-center justify-center rounded-full transition-colors hover:bg-accent"
          onClick={() => (step > 0 ? setStep(step - 1) : leave())}
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-[15px] font-bold">Nouvelle course</h1>
      </div>

      <div className="mx-auto w-full max-w-lg shrink-0 px-4 pt-1 pb-3">
        <StepProgress step={step} />
      </div>

      {step === 0 ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(7rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto w-full max-w-lg space-y-7">
              <div className="rise-in pt-1">
                <h2 className="text-[27px] leading-[1.15] font-extrabold tracking-tight">
                  {heading.title}
                </h2>
                <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">
                  {heading.sub}
                </p>
              </div>

              {/* Carte principale : l'itinéraire */}
              <div className="relative rounded-[28px] bg-card p-5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)]">
                <span className="absolute top-[46px] left-[31px] h-[52px] w-px bg-primary/35" />

                <button
                  type="button"
                  onClick={() => setSearchField("pickup")}
                  className="flex w-full items-center gap-4 rounded-2xl py-2 text-left transition-colors active:bg-muted/60"
                >
                  <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
                      Départ
                    </span>
                    <span
                      className={cn(
                        "block truncate text-[16px] font-semibold",
                        pickupOk ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {form.pickup_address || "Votre position ou une adresse"}
                    </span>
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Utiliser ma position"
                    title="Utiliser ma position"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      void fillMyLocation();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        void fillMyLocation();
                      }
                    }}
                  >
                    {locating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <LocateFixed className="size-4" />
                    )}
                  </span>
                </button>

                <div className="my-1 h-px bg-border/50" />

                <button
                  type="button"
                  onClick={() => setSearchField("dropoff")}
                  className="flex w-full items-center gap-4 rounded-2xl py-2 text-left transition-colors active:bg-muted/60"
                >
                  <span className="size-3.5 shrink-0 rounded-[5px] bg-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
                      Arrivée
                    </span>
                    <span
                      className={cn(
                        "block truncate text-[16px] font-semibold",
                        dropoffOk ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {form.dropoff_address || "Rechercher une destination"}
                    </span>
                  </span>
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </div>

              {/* Aperçu cartographique compact, uniquement après saisie complète */}
              {tripReady ? (
                previewState === "loading" ? (
                  <p className="flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Calcul de l'itinéraire…
                  </p>
                ) : preview ? (
                  <div className="rise-in overflow-hidden rounded-[24px] bg-card shadow-[0_18px_40px_-30px_rgba(0,0,0,0.45)]">
                    <RouteMiniMap
                      polyline={preview.polyline}
                      className="h-36 rounded-none border-0"
                    />
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <p className="text-[14px] font-semibold">
                        {preview.distanceKm} km · ~{preview.durationMin} min
                      </p>
                      <button
                        type="button"
                        className="text-[13px] font-bold text-primary"
                        onClick={() => setShowPreviewMap(true)}
                      >
                        Vérifier sur la carte
                      </button>
                    </div>
                  </div>
                ) : previewState === "error" ? (
                  <p className="px-1 text-[13px] text-muted-foreground">
                    L'itinéraire n'a pas pu être calculé pour le moment. Vous pouvez continuer ou
                    modifier vos adresses.
                  </p>
                ) : null
              ) : null}

              {/* Moment du départ */}
              <div>
                <h3 className="mb-3 text-[17px] font-extrabold tracking-tight">
                  Quand souhaitez-vous partir ?
                </h3>
                <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
                  {(
                    [
                      { key: "now", label: "Maintenant", sub: "Dès que possible", icon: Clock },
                      {
                        key: "later",
                        label: "Planifier",
                        sub: "Choisir une date",
                        icon: CalendarDays,
                      },
                    ] as const
                  ).map((o) => {
                    const Icon = o.icon;
                    const on = whenMode === o.key;
                    const disabled = o.key === "now" && !!form.driver_id && !driverAvailable;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        disabled={disabled}
                        onClick={() => setWhenMode(o.key)}
                        className={cn(
                          "relative rounded-3xl px-4 py-4 text-left transition-all",
                          on
                            ? "bg-primary/8 ring-2 ring-primary"
                            : "bg-card shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]",
                          disabled && "opacity-50",
                        )}
                      >
                        <Icon className={cn("size-6", on ? "text-primary" : "text-foreground")} />
                        <p className="mt-2.5 text-[16px] font-bold">{o.label}</p>
                        <p className="text-[13px] text-muted-foreground">{o.sub}</p>
                        {on ? (
                          <span className="animate-scale-in absolute top-3.5 right-3.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="size-3" />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {whenMode === "later" ? (
                  <div className="rise-in mt-3 rounded-3xl bg-card p-4 shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]">
                    <Label htmlFor="when" className="text-[13px] font-bold">
                      Date et heure du départ
                    </Label>
                    <Input
                      id="when"
                      aria-label="Date et heure du départ"
                      type="datetime-local"
                      min={toLocalInput(new Date(Date.now() + 15 * 60_000).toISOString())}
                      className="mt-2 h-12 rounded-2xl border-0 bg-muted text-[15px]"
                      value={form.scheduled_at}
                      onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                    />
                    {form.scheduled_at ? (
                      <p className="mt-2 text-[13px] font-semibold text-primary">
                        Départ prévu {formatDateTime(new Date(form.scheduled_at).toISOString())}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {form.driver_id && !driverAvailable ? (
                  <p className="mt-2 px-1 text-[12px] text-muted-foreground">
                    Ce chauffeur n'est pas en service : planifiez votre course.
                  </p>
                ) : null}
              </div>

              {/* Chauffeur — facultatif, en dernier */}
              <div>
                <div className="mb-3 flex items-baseline gap-2">
                  <h3 className="text-[17px] font-extrabold tracking-tight">
                    Avec quel chauffeur ?
                  </h3>
                  <span className="text-[12px] font-medium text-muted-foreground">Facultatif</span>
                </div>

                {selectedDriver ? (
                  <div className="rounded-3xl bg-card p-4 shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center gap-3">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[15px] font-bold text-primary">
                        {(selectedDriver.full_name ?? "C").slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold tracking-wide text-primary uppercase">
                          Chauffeur sélectionné
                        </p>
                        <p className="truncate text-[16px] font-bold">
                          Course demandée à {selectedDriver.full_name ?? "votre chauffeur"}
                        </p>
                        <p className="text-[13px] text-muted-foreground">
                          {driverAvailable
                            ? "Disponible actuellement"
                            : "Hors service actuellement"}
                        </p>
                      </div>
                    </div>
                    <div className="relative mt-3">
                      <select
                        aria-label="Modifier le chauffeur"
                        className="h-11 w-full appearance-none rounded-2xl bg-muted px-4 text-[14px] font-semibold focus:outline-none"
                        value={form.driver_id}
                        onChange={(e) => {
                          const id = e.target.value;
                          setForm({ ...form, driver_id: id });
                          const picked = (drivers.data ?? []).find((d) => d.id === id);
                          if (picked && !picked.on_duty) setWhenMode("later");
                        }}
                      >
                        <option value="">Modifier — aucun chauffeur</option>
                        {(drivers.data ?? []).map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.full_name} {d.on_duty ? "· Disponible" : "· Indisponible"}
                          </option>
                        ))}
                      </select>
                      <ChevronRight className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 rotate-90 text-muted-foreground" />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl bg-card p-4 shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <UserRound className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold">Trouver un chauffeur disponible</p>
                        <p className="text-[13px] text-muted-foreground">
                          ReLink recherchera un chauffeur adapté à votre demande
                        </p>
                      </div>
                    </div>
                    <div className="relative mt-3">
                      <select
                        aria-label="Choisir parmi mes chauffeurs"
                        className="h-11 w-full appearance-none rounded-2xl bg-muted px-4 text-[14px] font-semibold focus:outline-none"
                        value={form.driver_id}
                        onChange={(e) => {
                          const id = e.target.value;
                          setForm({ ...form, driver_id: id });
                          const picked = (drivers.data ?? []).find((d) => d.id === id);
                          if (picked && !picked.on_duty) setWhenMode("later");
                        }}
                      >
                        <option value="">Choisir parmi mes chauffeurs</option>
                        {(drivers.data ?? []).map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.full_name} {d.on_duty ? "· Disponible" : "· Indisponible"}
                          </option>
                        ))}
                      </select>
                      <ChevronRight className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 rotate-90 text-muted-foreground" />
                    </div>
                    {drivers.data && drivers.data.length === 0 ? (
                      <p className="mt-2 text-[12px] text-muted-foreground">
                        Aucun chauffeur dans votre carnet pour l'instant : ajoutez-en un depuis
                        l'onglet Chauffeurs.
                      </p>
                    ) : null}
                  </div>
                )}

                {checking || avail ? (
                  <div
                    className={cn(
                      "rise-in mt-3 rounded-3xl px-4 py-3 text-[13px]",
                      avail?.status === "available"
                        ? "bg-primary/10"
                        : avail?.status === "unavailable"
                          ? "bg-destructive/10"
                          : "bg-card",
                    )}
                  >
                    {checking ? (
                      <p className="flex items-center gap-2 font-medium text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> Vérification du créneau…
                      </p>
                    ) : avail ? (
                      <>
                        <p className="flex items-start gap-2 font-semibold">
                          {avail.status === "available" ? (
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                          ) : (
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                          )}
                          <span>{availabilityMessage(avail)}</span>
                        </p>
                        {avail.status === "later" && avail.earliestIso ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              className="rounded-xl"
                              onClick={() => {
                                setWhenMode("later");
                                setForm((f) => ({
                                  ...f,
                                  scheduled_at: toLocalInput(avail.earliestIso!),
                                }));
                                toast.success(
                                  `Créneau ${formatSlot(avail.earliestIso!)} sélectionné`,
                                );
                              }}
                            >
                              Choisir ce créneau
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl"
                              onClick={() => void findOtherDrivers()}
                            >
                              Voir d'autres chauffeurs
                            </Button>
                          </div>
                        ) : null}
                        {avail.status === "unavailable" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 rounded-xl"
                            onClick={() => void findOtherDrivers()}
                          >
                            Voir d'autres chauffeurs
                          </Button>
                        ) : null}
                        {avail.status === "unknown" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 rounded-xl"
                            onClick={() => void checkSelectedDriver()}
                          >
                            Réessayer
                          </Button>
                        ) : null}
                        {alternatives ? (
                          <div className="mt-2 space-y-1 border-t border-border/60 pt-2">
                            {alternatives.filter((a) => a.status === "available").length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                Aucun autre chauffeur de votre carnet n'est disponible à cette
                                heure.
                              </p>
                            ) : (
                              alternatives
                                .filter((a) => a.status === "available")
                                .map((a) => (
                                  <button
                                    key={a.driverId}
                                    type="button"
                                    className="flex w-full items-center justify-between rounded-xl bg-background px-3 py-2 text-left text-[13px] font-medium"
                                    onClick={() =>
                                      setForm((f) => ({ ...f, driver_id: a.driverId }))
                                    }
                                  >
                                    <span className="truncate">
                                      {(drivers.data ?? []).find((d) => d.id === a.driverId)
                                        ?.full_name ?? "Chauffeur"}
                                    </span>
                                    <span className="text-primary">Disponible</span>
                                  </button>
                                ))
                            )}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div
            className="shrink-0 bg-gradient-to-t from-background via-background to-transparent px-4 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
          >
            <div className="mx-auto w-full max-w-lg">
              {!tripReady ? (
                <p className="mb-2 text-center text-[12px] text-muted-foreground">
                  Indiquez un départ et une destination pour continuer.
                </p>
              ) : null}
              <Button
                size="lg"
                className="h-13 w-full rounded-2xl text-[15px] font-bold transition-transform active:scale-[0.99]"
                disabled={!tripReady || busy || checking}
                onClick={() => void next()}
              >
                {busy || checking ? <Loader2 className="size-4 animate-spin" /> : null}
                Continuer
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      ) : step === 1 ? (
        <OptionsStep
          pickup={form.pickup_address}
          dropoff={form.dropoff_address}
          whenLabel={formatDateTime(scheduledIso())}
          whenMode={whenMode}
          driverName={driverName}
          passengers={Number(form.passengers) || 1}
          luggage={Number(form.luggage) || 0}
          roundTrip={form.round_trip}
          comment={form.comment}
          needs={needs}
          returnMode={returnMode}
          returnAt={returnTrip.at}
          returnPickup={returnTrip.pickup}
          returnDropoff={returnTrip.dropoff}
          minReturnLocal={toLocalInput(scheduledIso())}
          busy={busy || checking}
          onEditTrip={() => setStep(0)}
          onContinue={() => void next()}
          onChange={(patch) => {
            if (patch.needs) {
              setNeeds(patch.needs);
              setForm((f) => ({ ...f, special_needs: serializeNeeds(patch.needs!) }));
            }
            if (patch.returnMode) setReturnMode(patch.returnMode);
            if (
              patch.returnAt !== undefined ||
              patch.returnPickup !== undefined ||
              patch.returnDropoff !== undefined
            ) {
              setReturnTrip((r) => ({
                at: patch.returnAt ?? r.at,
                pickup: patch.returnPickup ?? r.pickup,
                dropoff: patch.returnDropoff ?? r.dropoff,
              }));
            }
            setForm((f) => ({
              ...f,
              ...(patch.passengers !== undefined ? { passengers: String(patch.passengers) } : {}),
              ...(patch.luggage !== undefined ? { luggage: String(patch.luggage) } : {}),
              ...(patch.roundTrip !== undefined ? { round_trip: patch.roundTrip } : {}),
              ...(patch.comment !== undefined ? { comment: patch.comment } : {}),
            }));
          }}
        />
      ) : (
        <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col px-3 pb-2">
          <div key={`h-${step}`} className="rise-in shrink-0">
            <h2 className="text-xl font-extrabold tracking-tight">{heading.title}</h2>
            <p className="text-xs text-muted-foreground">{heading.sub}</p>
          </div>

          <div
            key={step}
            className={cn(
              "mt-2.5 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden",
              dir === 1 ? "step-in-right" : "step-in-left",
            )}
          >
            {step >= 2 && estimate ? (
              <>
                <LiveDriversMap polyline={estimate.polyline} className="min-h-24 flex-1" />

                <div className="animate-scale-in flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-accent px-3 py-2">
                  <div>
                    <p className="text-[10px] font-semibold tracking-wide text-accent-foreground uppercase">
                      Prix final
                    </p>
                    <p className="text-2xl font-extrabold leading-tight">
                      {formatEuro(estimate.price.total)}
                    </p>
                    <p className="text-[11px] text-accent-foreground">
                      Tarif garanti, aucun supplément
                    </p>
                  </div>
                  <div className="text-right text-xs text-accent-foreground">
                    <p>{estimate.distanceKm} km</p>
                    <p>~{estimate.durationMin} min</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card px-3 py-2 text-[13px]">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-1.5 block size-2.5 shrink-0 rounded-full bg-primary" />
                    <p className="truncate font-medium">{form.pickup_address}</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    <p className="truncate font-medium">{form.dropoff_address}</p>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-y-1 border-t border-border pt-2 text-xs">
                    <dt className="text-muted-foreground">Chauffeur</dt>
                    <dd className="truncate text-right font-medium">{driverName ?? "—"}</dd>
                    <dt className="text-muted-foreground">Départ</dt>
                    <dd className="text-right font-medium">{formatDateTime(scheduledIso())}</dd>
                    <dt className="text-muted-foreground">Passagers · bagages</dt>
                    <dd className="text-right font-medium">
                      {form.passengers} · {form.luggage}
                      {form.round_trip ? " · A/R" : ""}
                    </dd>
                  </dl>
                </div>

                {step === 3 ? (
                  <p className="text-[11px] text-muted-foreground">
                    En confirmant, votre demande est transmise à {driverName ?? "votre chauffeur"}{" "}
                    et reste « en attente » tant qu'il ne l'a pas acceptée.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          <div
            className="mt-2 flex shrink-0 items-center gap-2"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <Button
              variant="outline"
              size="lg"
              className="h-12 flex-1 rounded-2xl text-sm"
              disabled={step === 0 || busy}
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft className="size-4" /> Retour
            </Button>
            {step < 3 ? (
              <Button
                size="lg"
                className="h-12 flex-[2] rounded-2xl text-sm font-bold transition-transform active:scale-[0.98]"
                onClick={() => void next()}
                disabled={busy || checking}
              >
                {busy || checking ? <Loader2 className="size-4 animate-spin" /> : null}
                Continuer
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                size="lg"
                className="h-12 flex-[2] rounded-2xl text-sm font-bold transition-transform active:scale-[0.98]"
                onClick={submit}
                disabled={busy}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Confirmer
              </Button>
            )}
          </div>
        </div>
      )}

      {searchField ? (
        <AddressSearchPanel
          field={searchField}
          initialValue={searchField === "pickup" ? form.pickup_address : form.dropoff_address}
          locating={locating}
          {...(searchField === "pickup" ? { onUseMyLocation: () => void fillMyLocation() } : {})}
          onClose={() => setSearchField(null)}

          onSelect={(address) => {
            pushRecentAddress(address);
            if (searchField === "pickup") {
              setForm((f) => ({ ...f, pickup_address: address }));
              setPickupOk(true);
            } else {
              setForm((f) => ({ ...f, dropoff_address: address }));
              setDropoffOk(true);
            }
            setSearchField(null);
          }}
        />
      ) : null}

      {showPreviewMap && preview ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background">
          <div className="relative flex shrink-0 items-center justify-center px-2 py-2">
            <button
              type="button"
              aria-label="Fermer la carte"
              className="absolute left-2 flex size-10 items-center justify-center rounded-full hover:bg-accent"
              onClick={() => setShowPreviewMap(false)}
            >
              <X className="size-5" />
            </button>
            <p className="text-[15px] font-bold">Aperçu de l'itinéraire</p>
          </div>
          <RouteMiniMap
            polyline={preview.polyline}
            className="min-h-0 flex-1 rounded-none border-0"
          />
        </div>
      ) : null}

      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abandonner cette demande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les informations saisies pour ce trajet seront perdues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuer ma demande</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate({ to: "/espace" })}>
              Quitter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
