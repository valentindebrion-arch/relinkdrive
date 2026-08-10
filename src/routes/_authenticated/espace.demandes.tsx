import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  LocateFixed,
  Luggage,
  MapPin,
  SlidersHorizontal,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime, formatEuro } from "@/lib/labels";
import { LiveDriversMap } from "@/components/LiveDriversMap";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

const STEPS = [
  { label: "Trajet", icon: Car },
  { label: "Options", icon: SlidersHorizontal },
  { label: "Récapitulatif", icon: FileText },
  { label: "Confirmation", icon: CheckCircle2 },
];

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
  { title: "Où allez-vous ?", sub: "Renseignez votre trajet en quelques secondes." },
  { title: "Vos options", sub: "Passagers, bagages et précisions pour le chauffeur." },
  { title: "Votre récapitulatif", sub: "Vérifiez l'itinéraire et le tarif estimé." },
  { title: "Confirmer la demande", sub: "Elle sera transmise à votre chauffeur." },
];

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < step;
        const active = i === step;
        return (
          <div key={s.label} className="flex flex-1 items-center gap-1.5">
            <div
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                active
                  ? "bg-primary/10 text-primary ring-2 ring-primary"
                  : done
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
            </div>
            {active ? (
              <span className="truncate text-[11px] font-semibold text-primary">{s.label}</span>
            ) : null}
            {i < STEPS.length - 1 ? (
              <div
                className={cn(
                  "h-px min-w-2 flex-1 rounded-full",
                  done ? "bg-primary/50" : "bg-border",
                )}
              />
            ) : null}
          </div>
        );
      })}
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
        supabase.from("driver_profiles").select("user_id, on_duty").in("user_id", ids),
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

  async function useMyLocation() {
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
    const comment = [form.comment.trim(), estimateLine].filter(Boolean).join("\n");

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <button
          type="button"
          aria-label="Retour"
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
          onClick={() => (step > 0 ? setStep(step - 1) : navigate({ to: "/espace" }))}
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-sm font-bold">Demander un trajet</h1>
        <button
          type="button"
          aria-label="Fermer"
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
          onClick={() => navigate({ to: "/espace" })}
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="shrink-0 px-3 py-2">
        <StepBar step={step} />
      </div>

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
          {step === 0 ? (
            <>
              <div className="tap tap-active flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserRound className="size-4.5" />
                </span>
                <select
                  aria-label="Chauffeur"
                  className="h-11 w-full appearance-none bg-transparent text-[15px] font-medium focus:outline-none"
                  value={form.driver_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    setForm({ ...form, driver_id: id });
                    const picked = (drivers.data ?? []).find((d) => d.id === id);
                    if (picked && !picked.on_duty) setWhenMode("later");
                  }}
                >
                  <option value="">Sélectionner un chauffeur</option>
                  {(drivers.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} {d.on_duty ? "· Disponible" : "· Indisponible"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="tap rounded-2xl border border-border bg-card px-3.5 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <AddressAutocomplete
                  bare
                  label="Lieu de départ"
                  ariaLabel="Adresse de départ"
                  placeholder="Indiquez un lieu de départ"
                  icon={<span className="mt-1 block size-3 rounded-full bg-primary" />}
                  value={form.pickup_address}
                  confirmed={pickupOk}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, pickup_address: v }));
                    setPickupOk(false);
                    setEstimate(null);
                  }}
                  onConfirm={(v) => {
                    setForm((f) => ({ ...f, pickup_address: v }));
                    setPickupOk(true);
                    setEstimate(null);
                  }}
                  action={
                    <button
                      type="button"
                      title="Utiliser ma position"
                      aria-label="Utiliser ma position"
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground transition-colors hover:bg-accent"
                      onClick={useMyLocation}
                    >
                      {locating ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <LocateFixed className="size-4" />
                      )}
                    </button>
                  }
                />
                <div className="my-1 ml-[6px] h-3 border-l border-dashed border-border" />
                <AddressAutocomplete
                  bare
                  label="Lieu d'arrivée"
                  ariaLabel="Adresse d'arrivée"
                  placeholder="Indiquez votre destination"
                  icon={<MapPin className="mt-1 size-4" />}
                  value={form.dropoff_address}
                  confirmed={dropoffOk}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, dropoff_address: v }));
                    setDropoffOk(false);
                    setEstimate(null);
                  }}
                  onConfirm={(v) => {
                    setForm((f) => ({ ...f, dropoff_address: v }));
                    setDropoffOk(true);
                    setEstimate(null);
                  }}
                />
              </div>

              <div className="shrink-0">
                <SectionTitle>Date et heure</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { key: "now", label: "Maintenant", icon: Clock },
                      { key: "later", label: "Plus tard", icon: CalendarDays },
                    ] as const
                  ).map((o) => {
                    const Icon = o.icon;
                    const on = whenMode === o.key;
                    const disabled = o.key === "now" && !driverAvailable;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        disabled={disabled}
                        onClick={() => setWhenMode(o.key)}
                        className={cn(
                          "tap tap-active flex items-center justify-center gap-2 rounded-2xl border py-3.5 text-[15px] font-semibold",
                          disabled
                            ? "cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60"
                            : on
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card text-foreground",
                        )}
                      >
                        <Icon className={cn("size-4.5", on && "animate-scale-in")} /> {o.label}
                      </button>
                    );
                  })}
                </div>
                {whenMode === "later" ? (
                  <Input
                    aria-label="Date et heure du départ"
                    type="datetime-local"
                    className="rise-in mt-2 h-12 rounded-2xl text-[15px]"
                    value={form.scheduled_at}
                    onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  />
                ) : null}
                {!driverAvailable && form.driver_id ? (
                  <p className="rise-in mt-1 text-[11px] text-muted-foreground">
                    Chauffeur indisponible : réservation « plus tard » uniquement.
                  </p>
                ) : null}
              </div>

              {checking || avail ? (
                <div
                  className={cn(
                    "rise-in shrink-0 rounded-2xl border px-3 py-2.5 text-[13px]",
                    avail?.status === "available"
                      ? "border-primary/40 bg-primary/10"
                      : avail?.status === "unavailable"
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-border bg-muted",
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
                          <Clock className="mt-0.5 size-4 shrink-0" />
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
                        <div className="mt-2 space-y-1 border-t border-border pt-2">
                          {alternatives.filter((a) => a.status === "available").length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Aucun autre chauffeur de votre carnet n'est disponible à cette heure.
                            </p>
                          ) : (
                            alternatives
                              .filter((a) => a.status === "available")
                              .map((a) => (
                                <button
                                  key={a.driverId}
                                  type="button"
                                  className="tap tap-active flex w-full items-center justify-between rounded-xl bg-card px-3 py-2 text-left text-[13px] font-medium"
                                  onClick={() => setForm((f) => ({ ...f, driver_id: a.driverId }))}
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

              <LiveDriversMap className="min-h-28 flex-1" />
            </>
          ) : null}

          {step === 1 ? (
            <>
              <LiveDriversMap className="h-32 shrink-0" />

              <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pb-1">
                <div className="grid grid-cols-2 gap-2.5">
                  {(
                    [
                      { key: "passengers", label: "Passagers", icon: Users, min: 1, max: 8 },
                      { key: "luggage", label: "Bagages", icon: Luggage, min: 0, max: 10 },
                    ] as const
                  ).map((f) => {
                    const Icon = f.icon;
                    const val = Number(form[f.key]) || 0;
                    const set = (n: number) =>
                      setForm((prev) => ({
                        ...prev,
                        [f.key]: String(Math.min(f.max, Math.max(f.min, n))),
                      }));
                    return (
                      <div
                        key={f.key}
                        className="tap rounded-2xl border border-border bg-card px-3 py-2.5"
                      >
                        <p className="flex items-center gap-1.5 text-xs font-bold">
                          <Icon className="size-3.5 text-primary" /> {f.label}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between">
                          <button
                            type="button"
                            aria-label={`Moins de ${f.label}`}
                            onClick={() => set(val - 1)}
                            className="tap tap-active flex size-8 items-center justify-center rounded-xl bg-muted text-lg font-bold hover:bg-accent"
                          >
                            −
                          </button>
                          <span key={val} className="animate-scale-in text-xl font-extrabold">
                            {val}
                          </span>
                          <button
                            type="button"
                            aria-label={`Plus de ${f.label}`}
                            onClick={() => set(val + 1)}
                            className="tap tap-active flex size-8 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary hover:bg-primary/20"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="tap flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3.5 py-2.5">
                  <Label htmlFor="rt" className="text-[14px] font-bold">
                    Aller-retour
                  </Label>
                  <Switch
                    id="rt"
                    checked={form.round_trip}
                    onCheckedChange={(v) => setForm({ ...form, round_trip: v })}
                  />
                </div>

                <div className="tap flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Car className="size-4" />
                  </span>
                  <select
                    aria-label="Type de trajet"
                    className="h-10 w-full appearance-none bg-transparent text-[15px] font-medium focus:outline-none"
                    value={form.trip_type}
                    onChange={(e) => setForm({ ...form, trip_type: e.target.value })}
                  >
                    <option value="">Type de trajet</option>
                    {TRIP_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  aria-label="Besoins particuliers"
                  className="h-11 rounded-2xl text-[14px]"
                  maxLength={200}
                  placeholder="Besoins particuliers (facultatif)"
                  value={form.special_needs}
                  onChange={(e) => setForm({ ...form, special_needs: e.target.value })}
                />

                <Input
                  aria-label="Informations complémentaires"
                  className="h-11 rounded-2xl text-[14px]"
                  maxLength={500}
                  placeholder="Précisions : n° de vol, étage… (facultatif)"
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                />
              </div>
            </>
          ) : null}

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
                  En confirmant, votre demande est transmise à {driverName ?? "votre chauffeur"} et
                  reste « en attente » tant qu'il ne l'a pas acceptée.
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
    </div>
  );
}
