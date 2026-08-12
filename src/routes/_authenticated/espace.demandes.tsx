import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
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
  Star,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime, formatEuro } from "@/lib/labels";
import { RouteMiniMap } from "@/components/RouteMiniMap";
import { ScheduleSheet } from "@/components/request/ScheduleSheet";
import { AddressSearchPanel, pushRecentAddress } from "@/components/request/AddressSearchPanel";
import { DriverPickerSheet } from "@/components/request/DriverPickerSheet";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { loadRequestDraft, saveRequestDraft, clearRequestDraft } from "@/lib/request-draft";
import { BLOCKING_QUERY_KEY, newIdempotencyKey, useBlockingImmediate } from "@/lib/immediate-request";
import { useCountdown } from "@/components/ExpiryCountdown";

type CreateResult = {
  request_id: string | null;
  blocked: boolean;
  blocking_request_id: string | null;
  reused: boolean;
};
import {
  OptionsStep,
  serializeNeeds,
  type ReturnMode,
  type SpecialNeedsState,
} from "@/components/request/OptionsStep";
import { estimateRoute, reverseGeocode } from "@/lib/route-estimate.functions";
import { ReviewStep } from "@/components/request/ReviewStep";
import { LEGAL_VERSIONS } from "@/lib/legal-versions";
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

const STEP_LABELS = ["Votre trajet", "Vos options", "Vérification et confirmation"];

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
  {
    title: "Vérifiez et confirmez",
    sub: "Contrôlez les informations avant d'envoyer votre demande.",
  },
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
  // Vérité serveur : une seule demande « Maintenant » active par client.
  const blocking = useBlockingImmediate().data ?? null;
  const blockingCountdown = useCountdown(blocking?.response_deadline ?? null);
  useEffect(() => {
    if (blocking) setWhenMode("later");
  }, [blocking]);
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [driverPickerOpen, setDriverPickerOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [slotWarning, setSlotWarning] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  /** Empêche tout double envoi d'une même demande. */
  const sentRef = useRef(false);
  /** Clé d'idempotence : un rejeu réseau ne crée jamais de doublon côté serveur. */
  const idempotencyRef = useRef(newIdempotencyKey());
  const qc = useQueryClient();

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

  // Restaure un brouillon laissé avant un détour « ajouter un chauffeur ».
  useEffect(() => {
    const saved = loadRequestDraft();
    clearRequestDraft();
    if (!saved) return;
    setForm((f) => ({
      ...f,
      driver_id: search.driver ?? saved.driver_id ?? f.driver_id,
      pickup_address: saved.pickup_address,
      dropoff_address: saved.dropoff_address,
      scheduled_at: saved.scheduled_at,
    }));
    setPickupOk(saved.pickupOk);
    setDropoffOk(saved.dropoffOk);
    setWhenMode(saved.whenMode === "later" ? "later" : "now");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const [{ data }, { data: dprofiles }, { data: cars }, { data: past }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", ids),
        supabase.rpc("get_connected_driver_profiles"),
        supabase
          .from("vehicles")
          .select("driver_id, brand, model, color, is_primary")
          .in("driver_id", ids),
        supabase.from("rides").select("driver_id").eq("client_id", user!.id),
      ]);
      // Chauffeur « favori » = celui avec le plus de courses réalisées pour ce client.
      const counts = new Map<string, number>();
      (past ?? []).forEach((r) => counts.set(r.driver_id, (counts.get(r.driver_id) ?? 0) + 1));
      let favoriteId: string | null = null;
      counts.forEach((n, id) => {
        if (n > 0 && n > (favoriteId ? (counts.get(favoriteId) ?? 0) : 0)) favoriteId = id;
      });
      return (data ?? []).map((p) => {
        const profile = (dprofiles ?? []).find((d) => d.user_id === p.id);
        const car =
          (cars ?? []).find((c) => c.driver_id === p.id && c.is_primary) ??
          (cars ?? []).find((c) => c.driver_id === p.id);
        const vehicle = car
          ? [car.brand, car.model, car.color].filter(Boolean).join(" ").trim() || null
          : null;
        return {
          ...p,
          on_duty: profile?.on_duty ?? false,
          zone: profile?.zone ?? null,
          vehicle,
          favorite: p.id === favoriteId,
        };
      });
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
      if (!form.driver_id) {
        setDriverPickerOpen(true);
        return toast.error("Choisissez un chauffeur pour continuer");
      }
      if (whenMode === "now" && blocking)
        return toast.error("Une demande « Maintenant » est déjà en cours", {
          description: "Suivez-la ou annulez-la avant d'en envoyer une nouvelle.",
          action: {
            label: "Suivre",
            onClick: () =>
              navigate({ to: "/espace/suivi/$id", params: { id: blocking.request_id } }),
          },
        });
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
    if (busy || sentRef.current) return;
    sentRef.current = true;
    setSubmitError(null);
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
        sentRef.current = false;
        setBusy(false);
        setSubmitError(
          verdict ? availabilityMessage(verdict) : "Ce créneau n'est plus réalisable.",
        );
        setAvail(verdict);
        setStep(0);
        toast.error("Ce créneau n'est plus réalisable", {
          description: verdict ? availabilityMessage(verdict) : undefined,
        });
        return;
      }
    } catch {
      sentRef.current = false;
      setBusy(false);
      setSubmitError("Vérification du créneau impossible. Réessayez dans un instant.");
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

    // Création atomique côté serveur : une seule demande « Maintenant » en attente
    // par client, rejeu protégé par clé d'idempotence, acceptation des CGU tracée.
    const { data, error } = await supabase.rpc("create_client_ride_request", {
      _driver: form.driver_id,
      _pickup: form.pickup_address.trim(),
      _dropoff: form.dropoff_address.trim(),
      _scheduled_at: scheduledIso(),
      _passengers: Number(form.passengers),
      _luggage: Number(form.luggage),
      _round_trip: form.round_trip,
      _trip_type: form.trip_type.trim() || null,
      _special_needs: form.special_needs.trim() || null,
      _comment: comment || null,
      _proposed_price: estimate ? estimate.price.total : null,
      _immediate: whenMode === "now",
      _idempotency_key: idempotencyRef.current,
      _cgu_version: LEGAL_VERSIONS.cgu,
      _cgv_version: LEGAL_VERSIONS.cgv,
      _cancellation_version: LEGAL_VERSIONS.cancellation,
    } as never);
    setBusy(false);
    const created = (data as unknown as CreateResult[] | null)?.[0] ?? null;

    if (error) {
      sentRef.current = false;
      setSubmitError(error.message);
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

    if (created?.blocked) {
      sentRef.current = false;
      setSubmitError("Une demande immédiate est déjà en attente de réponse.");
      toast.error("Une demande est déjà en cours", {
        description: "Suivez-la ou annulez-la avant d'en envoyer une nouvelle.",
        action: created.blocking_request_id
          ? {
              label: "Suivre",
              onClick: () =>
                navigate({ to: "/espace/suivi/$id", params: { id: created.blocking_request_id! } }),
            }
          : undefined,
      });
      return;
    }

    if (!created?.request_id) {
      sentRef.current = false;
      setSubmitError("Envoi impossible. Réessayez dans un instant.");
      return;
    }

    void qc.invalidateQueries({ queryKey: [BLOCKING_QUERY_KEY] });
    void qc.invalidateQueries({ queryKey: ["client-home"] });
    if (!created.reused) toast.success("Demande envoyée — en attente de la réponse du chauffeur");
    idempotencyRef.current = newIdempotencyKey();
    resetForm();
    navigate({ to: "/espace/suivi/$id", params: { id: created.request_id } });
  }
  const heading = HEADINGS[step]!;
  const draft = {
    driver_id: form.driver_id,
    pickup_address: form.pickup_address,
    dropoff_address: form.dropoff_address,
    scheduled_at: form.scheduled_at,
    whenMode,
    pickupOk,
    dropoffOk,
  };

  const selectedDriver = (drivers.data ?? []).find((d) => d.id === form.driver_id);
  const driverName = selectedDriver?.full_name;
  const driverAvailable = !!selectedDriver?.on_duty;

  const scheduleValid =
    whenMode === "now" ||
    (!!form.scheduled_at && new Date(form.scheduled_at).getTime() > Date.now());
  const missing = !form.driver_id
    ? "Choisissez un chauffeur pour continuer."
    : !pickupOk
      ? "Indiquez votre point de départ."
      : !dropoffOk
        ? "Indiquez votre destination."
        : !scheduleValid
          ? "Choisissez une date et une heure valides."
          : null;
  const tripReady = !missing;
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
            <div className="mx-auto w-full max-w-lg space-y-4">
              <div className="rise-in">
                <h2 className="text-[22px] leading-tight font-extrabold tracking-tight">
                  Préparons votre trajet
                </h2>
                <p className="mt-1 hidden text-[13.5px] leading-snug text-muted-foreground min-[400px]:block">
                  Choisissez votre chauffeur et indiquez votre trajet.
                </p>
              </div>

              {/* 1. Chauffeur — obligatoire, première action */}
              <section aria-labelledby="drv">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 id="drv" className="text-[15px] font-extrabold tracking-tight">
                    Votre chauffeur
                  </h3>
                  <span className="text-[12px] font-semibold text-muted-foreground">
                    Obligatoire
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setDriverPickerOpen(true)}
                  aria-label={
                    selectedDriver ? "Modifier le chauffeur" : "Choisir un chauffeur"
                  }
                  className="flex w-full items-center gap-3 rounded-[26px] bg-card p-3.5 text-left shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)] transition-colors active:bg-muted/60"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[15px] font-bold text-primary">
                    {selectedDriver ? (
                      (selectedDriver.full_name ?? "C").slice(0, 2).toUpperCase()
                    ) : (
                      <Users className="size-5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    {selectedDriver ? (
                      <>
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[15.5px] font-bold">
                            Course demandée à {selectedDriver.full_name ?? "votre chauffeur"}
                          </span>
                          {selectedDriver.favorite ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                              <Star className="size-3" /> Favori
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block text-[12.5px] font-bold",
                            driverAvailable ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {driverAvailable ? "Disponible maintenant" : "Hors service actuellement"}
                        </span>
                        {selectedDriver.vehicle ? (
                          <span className="block truncate text-[12.5px] text-muted-foreground">
                            {selectedDriver.vehicle}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className="block text-[15.5px] font-bold">Choisir un chauffeur</span>
                        <span className="block text-[12.5px] text-muted-foreground">
                          Sélectionnez un chauffeur de confiance
                        </span>
                      </>
                    )}
                  </span>
                  <span className="shrink-0 text-[13px] font-bold text-primary">
                    {selectedDriver ? "Modifier" : <ChevronRight className="size-5" />}
                  </span>
                </button>

                {selectedDriver && !driverAvailable ? (
                  <p className="mt-2 flex items-start gap-2 rounded-2xl bg-muted/70 px-3.5 py-2.5 text-[12.5px] leading-snug text-muted-foreground">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Ce chauffeur n'est pas disponible immédiatement. Planifiez votre trajet ou
                      choisissez un autre chauffeur.
                    </span>
                  </p>
                ) : null}
              </section>

              {/* Carte principale : l'itinéraire */}
              <div className="relative rounded-[26px] bg-card p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)]">
                <span className="absolute top-[42px] left-[27px] h-[48px] w-px bg-primary/35" />

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
                    const disabled =
                      o.key === "now" && (!!blocking || (!!form.driver_id && !driverAvailable));
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
                    {!form.driver_id ? (
                      <p className="text-[13.5px] text-muted-foreground">
                        Choisissez d'abord un chauffeur pour consulter ses disponibilités.
                      </p>
                    ) : !pickupOk || !dropoffOk ? (
                      <p className="text-[13.5px] text-muted-foreground">
                        Indiquez votre départ et votre destination pour consulter l'agenda de
                        votre chauffeur.
                      </p>
                    ) : form.scheduled_at ? (
                      <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                          <CalendarDays className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold">Course planifiée</p>
                          <p className="text-[15px] font-semibold">
                            {formatSlotFull(form.scheduled_at)}
                          </p>
                          <p className="text-[12px] text-muted-foreground">
                            Avec {driverName ?? "votre chauffeur"} · heure de Paris
                          </p>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 text-[13px] font-bold text-primary"
                          onClick={() => setScheduleOpen(true)}
                        >
                          Modifier le créneau
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-[13px] font-bold">Date et heure du départ</p>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                          Agenda synchronisé avec le planning de {driverName ?? "votre chauffeur"}.
                        </p>
                        <Button
                          className="mt-3 h-12 w-full rounded-2xl text-[14.5px] font-bold"
                          onClick={() => setScheduleOpen(true)}
                        >
                          <CalendarDays className="size-4" /> Voir les disponibilités
                        </Button>
                      </>
                    )}
                    {slotWarning ? (
                      <p className="mt-2 flex items-start gap-2 text-[12.5px] text-destructive">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        {slotWarning}
                      </p>
                    ) : null}
                  </div>
                ) : null}


                {blocking ? (
                  <button
                    type="button"
                    onClick={() =>
                      navigate({ to: "/espace/suivi/$id", params: { id: blocking.request_id } })
                    }
                    className="mt-3 flex w-full items-center gap-3 rounded-3xl border border-primary/30 bg-primary/[0.06] p-3.5 text-left"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                      <Loader2 className="size-4 animate-spin" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold">
                        Une demande « Maintenant » est déjà en cours
                      </span>
                      <span className="block text-[12px] text-muted-foreground">
                        {blockingCountdown
                          ? `Réponse attendue sous ${blockingCountdown.label}. `
                          : ""}
                        Suivez-la ou annulez-la pour en envoyer une nouvelle.
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-primary" />
                  </button>
                ) : form.driver_id && !driverAvailable ? (
                  <p className="mt-2 px-1 text-[12px] text-muted-foreground">
                    Ce chauffeur n'est pas en service : planifiez votre course.
                  </p>
                ) : null}
              </div>

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
              {/* Itinéraire calculé en arrière-plan : aucun affichage cartographique ici. */}
              {tripReady ? (
                previewState === "loading" ? (
                  <p className="flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Calcul de l'itinéraire…
                  </p>
                ) : preview ? (
                  <p className="px-1 text-[13px] font-semibold text-muted-foreground">
                    Trajet estimé : {preview.distanceKm} km · ~{preview.durationMin} min
                  </p>
                ) : previewState === "error" ? (
                  <p className="px-1 text-[13px] text-muted-foreground">
                    L'itinéraire n'a pas pu être calculé pour le moment. Vous pouvez continuer ou
                    modifier vos adresses.
                  </p>
                ) : null
              ) : null}


            </div>
          </div>

          <div
            className="shrink-0 bg-gradient-to-t from-background via-background to-transparent px-4 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
          >
            <div className="mx-auto w-full max-w-lg">
              {missing ? (
                <p aria-live="polite" className="mb-2 text-center text-[12px] text-muted-foreground">
                  {missing}
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
        <ReviewStep
          pickup={form.pickup_address}
          dropoff={form.dropoff_address}
          whenLabel={formatDateTime(scheduledIso())}
          whenMode={whenMode}
          estimate={estimate}
          roundTrip={form.round_trip}
          returnLabel={
            form.round_trip
              ? returnMode === "scheduled"
                ? `${returnTrip.at ? formatDateTime(new Date(returnTrip.at).toISOString()) : "—"} · ${returnTrip.pickup || form.dropoff_address} → ${returnTrip.dropoff || form.pickup_address}`
                : "Immédiatement après la course"
              : null
          }
          passengers={Number(form.passengers) || 1}
          luggage={Number(form.luggage) || 0}
          needsLabel={form.special_needs}
          comment={form.comment}
          driver={
            selectedDriver ? { name: driverName ?? "Chauffeur", available: driverAvailable } : null
          }
          driverStatusLabel={
            selectedDriver
              ? driverAvailable
                ? "En service actuellement"
                : "Hors service actuellement"
              : null
          }
          busy={busy || checking}
          blockedReason={null}
          errorMessage={submitError}
          onEditTrip={() => setStep(0)}
          onEditDriver={() => {
            setStep(0);
            setDriverPickerOpen(true);
          }}
          onEditOptions={() => setStep(1)}
          onExpandMap={() => setShowPreviewMap(true)}
          onSubmit={() => void submit()}
        />
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

      {showPreviewMap && (step === 2 ? estimate?.polyline : preview?.polyline) ? (
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
            polyline={(step === 2 ? estimate?.polyline : preview?.polyline) ?? ""}
            className="min-h-0 flex-1 rounded-none border-0"
          />
        </div>
      ) : null}

      <DriverPickerSheet
        open={driverPickerOpen}
        onOpenChange={setDriverPickerOpen}
        loading={drivers.isLoading}
        selectedId={form.driver_id}
        drivers={(drivers.data ?? []).map((d) => ({
          id: d.id,
          name: d.full_name || "Chauffeur",
          available: d.on_duty,
          vehicle: d.vehicle,
          zone: d.zone,
          favorite: d.favorite,
        }))}
        onSelect={(id) => {
          const picked = (drivers.data ?? []).find((d) => d.id === id);
          setForm((f) => ({ ...f, driver_id: id }));
          if (picked && !picked.on_duty) setWhenMode("later");
          setDriverPickerOpen(false);
        }}
        onScanQr={() => {
          setDriverPickerOpen(false);
          setScanOpen(true);
        }}
        onAddDriver={() => {
          saveRequestDraft(draft);
          navigate({ to: "/espace/chauffeurs" });
        }}
      />

      <QrScannerDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onResult={(text) => {
          setScanOpen(false);
          let slug: string | null = null;
          try {
            const url = new URL(text, window.location.origin);
            slug = url.pathname.match(/\/chauffeur\/([^/?#]+)/)?.[1] ?? null;
          } catch {
            slug = null;
          }
          if (!slug) slug = text.trim().match(/([A-Za-z0-9-]+)$/)?.[1] ?? null;
          if (!slug) {
            toast.error("QR code non reconnu", {
              description: "Ce code ne correspond pas à un chauffeur Relink.",
            });
            return;
          }
          saveRequestDraft(draft);
          navigate({ to: "/chauffeur/$slug", params: { slug } });
        }}
      />

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
