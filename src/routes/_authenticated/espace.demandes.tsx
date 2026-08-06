import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
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
import { RouteMiniMap } from "@/components/RouteMiniMap";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { estimateRoute, reverseGeocode } from "@/lib/route-estimate.functions";
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

const HEADINGS = [
  { title: "Où allez-vous ?", sub: "Renseignez votre trajet en quelques secondes." },
  { title: "Vos options", sub: "Passagers, bagages et précisions pour le chauffeur." },
  { title: "Votre récapitulatif", sub: "Vérifiez l'itinéraire et le tarif estimé." },
  { title: "Confirmer la demande", sub: "Elle sera transmise à votre chauffeur." },
];

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-start">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < step;
        const active = i === step;
        return (
          <div key={s.label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <div className="h-px flex-1">
                {i > 0 ? (
                  <div className={cn("h-px w-full", done || active ? "bg-primary/40" : "bg-border")} />
                ) : null}
              </div>
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                  active
                    ? "bg-primary/10 text-primary ring-2 ring-primary"
                    : done
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-5" /> : <Icon className="size-5" />}
              </div>
              <div className="h-px flex-1">
                {i < STEPS.length - 1 ? (
                  <div className={cn("h-px w-full", done ? "bg-primary/40" : "bg-border")} />
                ) : null}
              </div>
            </div>
            <span
              className={cn(
                "mt-2 text-center text-[11px] font-semibold sm:text-xs",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {i + 1}. {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-sm font-bold">{children}</p>;
}

function ClientRequests() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const estimateFn = useServerFn(estimateRoute);
  const geocodeFn = useServerFn(reverseGeocode);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pickupOk, setPickupOk] = useState(false);
  const [dropoffOk, setDropoffOk] = useState(false);
  const [whenMode, setWhenMode] = useState<"now" | "later">("now");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
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

  function next() {
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
    const estimateLine = estimate
      ? `Prix final Relink : ${formatEuro(estimate.price.total)} · ${estimate.distanceKm} km · ~${estimate.durationMin} min`
      : null;
    const comment = [form.comment.trim(), estimateLine].filter(Boolean).join("\n");
    const { error } = await supabase.from("ride_requests").insert({
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
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.rpc("notify_counterparty", { _recipient: form.driver_id, _kind: "request_new" });
    toast.success("Demande envoyée — en attente de confirmation du chauffeur");
    resetForm();
  }
  const heading = HEADINGS[step]!;
  const selectedDriver = (drivers.data ?? []).find((d) => d.id === form.driver_id);
  const driverName = selectedDriver?.full_name;
  const driverAvailable = !!selectedDriver?.on_duty;

  return (
    <>
      <div className="-mx-4 mb-6 sm:-mx-6">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
          <button
            type="button"
            aria-label="Retour"
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
            onClick={() => (step > 0 ? setStep(step - 1) : navigate({ to: "/espace" }))}
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-base font-bold">Demander un trajet</h1>
          <button
            type="button"
            aria-label="Fermer"
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
            onClick={() => navigate({ to: "/espace" })}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-4 pt-6 sm:px-6">
          <StepBar step={step} />
        </div>
      </div>

      <div className="pb-28 sm:pb-6">
        <p className="text-sm font-bold text-primary">
          Étape {step + 1} sur {STEPS.length}
        </p>
        <h2 className="mt-1 text-3xl font-extrabold tracking-tight">{heading.title}</h2>
        <p className="mt-1 text-[15px] text-muted-foreground">{heading.sub}</p>

        <div key={step} className="animate-fade-in mt-6 space-y-6">
          {step === 0 ? (
            <>
              <div>
                <SectionTitle>Chauffeur</SectionTitle>
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <UserRound className="size-5" />
                  </span>
                  <select
                    aria-label="Chauffeur"
                    className="h-10 w-full appearance-none bg-transparent text-[15px] focus:outline-none"
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
              </div>

              <div>
                <SectionTitle>Itinéraire</SectionTitle>
                <div className="rounded-2xl border border-border bg-card p-3">
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
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground transition-colors hover:bg-accent"
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
                  <div className="my-2 ml-[6px] h-4 border-l border-dashed border-border" />
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
              </div>

              <div>
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
                          "flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-medium transition-all",
                          disabled
                            ? "cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60"
                            : on
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card text-foreground",
                        )}
                      >
                        <Icon className="size-4" /> {o.label}
                      </button>
                    );
                  })}
                </div>
                {!driverAvailable && form.driver_id ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Ce chauffeur est actuellement indisponible : vous pouvez uniquement réserver
                    pour plus tard.
                  </p>
                ) : null}
                {whenMode === "later" ? (
                  <Input
                    aria-label="Date et heure du départ"
                    type="datetime-local"
                    className="animate-fade-in mt-3 h-12 rounded-2xl"
                    value={form.scheduled_at}
                    onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  />
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Départ dès que possible — le chauffeur peut proposer un autre horaire.
                  </p>
                )}
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border bg-card p-3">
                  <Label htmlFor="pa" className="flex items-center gap-2 text-sm font-bold">
                    <Users className="size-4 text-primary" /> Passagers
                  </Label>
                  <Input
                    id="pa"
                    type="number"
                    min="1"
                    max="8"
                    className="mt-2 h-11 rounded-xl"
                    value={form.passengers}
                    onChange={(e) => setForm({ ...form, passengers: e.target.value })}
                  />
                </div>
                <div className="rounded-2xl border border-border bg-card p-3">
                  <Label htmlFor="lu" className="flex items-center gap-2 text-sm font-bold">
                    <Luggage className="size-4 text-primary" /> Bagages
                  </Label>
                  <Input
                    id="lu"
                    type="number"
                    min="0"
                    max="10"
                    className="mt-2 h-11 rounded-xl"
                    value={form.luggage}
                    onChange={(e) => setForm({ ...form, luggage: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                <Label htmlFor="rt" className="text-sm font-bold">
                  Aller-retour
                </Label>
                <Switch
                  id="rt"
                  checked={form.round_trip}
                  onCheckedChange={(v) => setForm({ ...form, round_trip: v })}
                />
              </div>

              <div>
                <SectionTitle>Type de trajet</SectionTitle>
                <Input
                  aria-label="Type de trajet"
                  className="h-12 rounded-2xl"
                  maxLength={60}
                  placeholder="Aéroport, gare, événement…"
                  value={form.trip_type}
                  onChange={(e) => setForm({ ...form, trip_type: e.target.value })}
                />
              </div>

              <div>
                <SectionTitle>Besoins particuliers</SectionTitle>
                <Input
                  aria-label="Besoins particuliers"
                  className="h-12 rounded-2xl"
                  maxLength={200}
                  placeholder="Siège enfant, PMR…"
                  value={form.special_needs}
                  onChange={(e) => setForm({ ...form, special_needs: e.target.value })}
                />
              </div>

              <div>
                <SectionTitle>Informations complémentaires</SectionTitle>
                <Textarea
                  aria-label="Informations complémentaires"
                  className="min-h-24 rounded-2xl"
                  maxLength={500}
                  placeholder="Numéro de vol, étage, précisions…"
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                />
              </div>
            </>
          ) : null}

          {step >= 2 && estimate ? (
            <>
              <RouteMiniMap polyline={estimate.polyline} className="h-52" />

              <div className="animate-scale-in flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-accent p-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-accent-foreground uppercase">
                    Prix final
                  </p>
                  <p className="text-3xl font-extrabold">{formatEuro(estimate.price.total)}</p>
                  <p className="text-xs text-accent-foreground">Tarif garanti, aucun supplément</p>
                </div>
                <div className="text-right text-sm text-accent-foreground">
                  <p>{estimate.distanceKm} km</p>
                  <p>~{estimate.durationMin} min</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 block size-3 shrink-0 rounded-full bg-primary" />
                  <p className="font-medium">{form.pickup_address}</p>
                </div>
                <div className="my-1 ml-[6px] h-4 border-l border-dashed border-border" />
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  <p className="font-medium">{form.dropoff_address}</p>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-y-2 border-t border-border pt-3 text-[13px]">
                  <dt className="text-muted-foreground">Chauffeur</dt>
                  <dd className="text-right font-medium">{driverName ?? "—"}</dd>
                  <dt className="text-muted-foreground">Départ</dt>
                  <dd className="text-right font-medium">{formatDateTime(scheduledIso())}</dd>
                  <dt className="text-muted-foreground">Passagers · bagages</dt>
                  <dd className="text-right font-medium">
                    {form.passengers} · {form.luggage}
                  </dd>
                  {form.round_trip ? (
                    <>
                      <dt className="text-muted-foreground">Aller-retour</dt>
                      <dd className="text-right font-medium">Oui</dd>
                    </>
                  ) : null}
                  {form.special_needs ? (
                    <>
                      <dt className="text-muted-foreground">Besoins</dt>
                      <dd className="text-right font-medium">{form.special_needs}</dd>
                    </>
                  ) : null}
                  <dt className="border-t border-border pt-2 font-semibold">Prix final</dt>
                  <dd className="border-t border-border pt-2 text-right text-base font-extrabold">
                    {formatEuro(estimate.price.total)}
                  </dd>
                </dl>
              </div>

              {step === 2 ? (
                <p className="text-xs text-muted-foreground">
                  Base 1,90 €/km, minimum 9 € ({formatEuro(estimate.price.base)}), arrondi à l'euro
                  supérieur — {formatEuro(estimate.price.tip)} de pourboire pour le chauffeur. Ce prix
                  est le prix final de la course, aucun supplément ne sera ajouté.
                </p>
              ) : (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
                  <p className="font-semibold">Dernière vérification</p>
                  <p className="mt-1 text-muted-foreground">
                    En confirmant, votre demande est transmise à {driverName ?? "votre chauffeur"}. Elle
                    reste « en attente » tant qu'il ne l'a pas acceptée.
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-border bg-card/95 p-4 backdrop-blur sm:static sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0">
          <Button
            variant="outline"
            size="lg"
            className="h-14 flex-1 rounded-2xl text-base"
            disabled={step === 0 || busy}
            onClick={() => setStep(step - 1)}
          >
            <ArrowLeft className="size-4" /> Retour
          </Button>
          {step < 3 ? (
            <Button
              size="lg"
              className="h-14 flex-[2] rounded-2xl text-base font-bold transition-transform active:scale-[0.98]"
              onClick={next}
              disabled={busy}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Continuer
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              size="lg"
              className="h-14 flex-[2] rounded-2xl text-base font-bold transition-transform active:scale-[0.98]"
              onClick={submit}
              disabled={busy}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Confirmer
            </Button>
          )}
        </div>
      </div>

    </>
  );
}
