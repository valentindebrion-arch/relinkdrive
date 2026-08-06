import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  Loader2,
  LocateFixed,
  MapPin,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, formatDateTime, formatEuro } from "@/lib/labels";
import { RouteMiniMap } from "@/components/RouteMiniMap";
import { estimateRoute, reverseGeocode } from "@/lib/route-estimate.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

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

const STEPS = ["Trajet", "Date", "Détails", "Confirmation"];

function StepBar({ step }: { step: number }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "scale-110 bg-primary/15 text-primary ring-2 ring-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="size-4" /> : i + 1}
            </div>
            <span className={`hidden text-xs font-medium sm:block ${i === step ? "" : "text-muted-foreground"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 ? (
              <div className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-border">
                <div
                  className="absolute inset-y-0 left-0 bg-primary transition-all duration-500"
                  style={{ width: i < step ? "100%" : "0%" }}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:hidden">
        Étape {step + 1}/{STEPS.length} · {STEPS[step]}
      </p>
    </div>
  );
}

function ClientRequests() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const estimateFn = useServerFn(estimateRoute);
  const geocodeFn = useServerFn(reverseGeocode);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pickupOk, setPickupOk] = useState(false);
  const [dropoffOk, setDropoffOk] = useState(false);
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
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return data ?? [];
    },
  });

  const requests = useQuery({
    queryKey: ["client-requests", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("ride_requests")
        .select("*")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

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
      setStep(3);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Estimation impossible");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (step === 0) {
      if (!form.driver_id) return toast.error("Choisissez un chauffeur");
      if (!pickupOk) return toast.error("Confirmez l'adresse de départ dans la liste proposée");
      if (!dropoffOk) return toast.error("Confirmez l'adresse d'arrivée dans la liste proposée");
      setEstimate(null);
      return setStep(1);
    }
    if (step === 1) {
      if (!form.scheduled_at) return toast.error("Choisissez une date et une heure");
      return setStep(2);
    }
    if (step === 2) return void computeEstimate();
  }

  async function submit() {
    setBusy(true);
    const estimateLine = estimate
      ? `Estimation Relink : ${estimate.distanceKm} km · ~${estimate.durationMin} min · ${formatEuro(estimate.price.total)}`
      : null;
    const comment = [form.comment.trim(), estimateLine].filter(Boolean).join("\n");
    const { error } = await supabase.from("ride_requests").insert({
      client_id: user!.id,
      driver_id: form.driver_id,
      pickup_address: form.pickup_address.trim(),
      dropoff_address: form.dropoff_address.trim(),
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      passengers: Number(form.passengers),
      luggage: Number(form.luggage),
      comment: comment || null,
      special_needs: form.special_needs.trim() || null,
      round_trip: form.round_trip,
      trip_type: form.trip_type.trim() || null,
      status: "new",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("notifications").insert({
      user_id: form.driver_id,
      title: "Nouvelle demande de trajet",
      body: `${form.pickup_address} → ${form.dropoff_address}`,
      kind: "request",
      link: "/pro/demandes",
    });
    toast.success("Demande envoyée — en attente de confirmation du chauffeur");
    setForm({
      ...form,
      pickup_address: "",
      dropoff_address: "",
      scheduled_at: "",
      comment: "",
      special_needs: "",
    });
    setPickupOk(false);
    setDropoffOk(false);
    setEstimate(null);
    setStep(0);
    void qc.invalidateQueries({ queryKey: ["client-requests"] });
  }

  async function accept(id: string) {
    await supabase.from("ride_requests").update({ status: "awaiting_client" }).eq("id", id);
    void qc.invalidateQueries({ queryKey: ["client-requests"] });
    toast.success("Réponse transmise au chauffeur");
  }

  async function cancel(id: string) {
    await supabase.from("ride_requests").update({ status: "cancelled" }).eq("id", id);
    void qc.invalidateQueries({ queryKey: ["client-requests"] });
  }

  const list = requests.data ?? [];

  return (
    <>
      <PageHeader title="Demander un trajet" description="Quatre étapes, estimation immédiate du tarif." />

      <div className="surface mb-8 overflow-hidden p-5 pb-24 sm:pb-5">
        <StepBar step={step} />

        <div key={step} className="animate-fade-in">
          {step === 0 ? (
            <div className="grid gap-4">
              <div>
                <Label htmlFor="drv">Chauffeur</Label>
                <select
                  id="drv"
                  className="mt-1 h-12 w-full rounded-2xl border border-input bg-background px-3 text-sm transition-colors focus:ring-2 focus:ring-ring focus:outline-none"
                  value={form.driver_id}
                  onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
                >
                  <option value="">Sélectionner…</option>
                  {(drivers.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3">
                <AddressAutocomplete
                  ariaLabel="Adresse de départ"
                  placeholder="Adresse de départ"
                  icon={<span className="block size-2.5 rounded-full bg-primary" />}
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={useMyLocation}
                      title="Utiliser ma position"
                    >
                      {locating ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <LocateFixed className="size-4" />
                      )}
                    </Button>
                  }
                />
                <AddressAutocomplete
                  ariaLabel="Adresse d'arrivée"
                  placeholder="Adresse d'arrivée"
                  icon={<MapPin className="size-4" />}
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

              <p className="text-xs text-muted-foreground">
                Sélectionnez chaque adresse dans la liste proposée pour la confirmer.
              </p>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="sa">Date et heure du départ</Label>
                <Input
                  id="sa"
                  type="datetime-local"
                  className="mt-1 h-12 rounded-2xl"
                  value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="tt">Type de trajet</Label>
                <Input
                  id="tt"
                  className="mt-1 h-12 rounded-2xl"
                  maxLength={60}
                  placeholder="Aéroport, gare, événement…"
                  value={form.trip_type}
                  onChange={(e) => setForm({ ...form, trip_type: e.target.value })}
                />
              </div>
              <p className="text-sm text-muted-foreground sm:col-span-2">
                <CalendarClock className="mr-1 inline size-4" />
                Le chauffeur reçoit votre créneau et peut proposer un autre horaire.
              </p>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="pa">Passagers</Label>
                <Input
                  id="pa"
                  type="number"
                  min="1"
                  max="8"
                  className="mt-1 h-12 rounded-2xl"
                  value={form.passengers}
                  onChange={(e) => setForm({ ...form, passengers: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="lu">Bagages</Label>
                <Input
                  id="lu"
                  type="number"
                  min="0"
                  max="10"
                  className="mt-1 h-12 rounded-2xl"
                  value={form.luggage}
                  onChange={(e) => setForm({ ...form, luggage: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-border p-3 sm:col-span-2">
                <Switch
                  id="rt"
                  checked={form.round_trip}
                  onCheckedChange={(v) => setForm({ ...form, round_trip: v })}
                />
                <Label htmlFor="rt">Aller-retour</Label>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="sn">Besoins particuliers</Label>
                <Input
                  id="sn"
                  className="mt-1 h-12 rounded-2xl"
                  maxLength={200}
                  placeholder="Siège enfant, PMR…"
                  value={form.special_needs}
                  onChange={(e) => setForm({ ...form, special_needs: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="co">Informations complémentaires</Label>
                <Textarea
                  id="co"
                  className="mt-1 rounded-2xl"
                  maxLength={500}
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                />
              </div>
            </div>
          ) : null}

          {step === 3 && estimate ? (
            <div className="grid gap-4">
              <RouteMiniMap polyline={estimate.polyline} className="h-52" />
              <div className="animate-scale-in flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-accent p-4">
                <div>
                  <p className="text-xs font-medium tracking-wide text-accent-foreground uppercase">
                    Prix estimé
                  </p>
                  <p className="text-3xl font-semibold">{formatEuro(estimate.price.total)}</p>
                </div>
                <div className="text-right text-sm text-accent-foreground">
                  <p>{estimate.distanceKm} km</p>
                  <p>~{estimate.durationMin} min</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Base 1,90 €/km, minimum 9 € ({formatEuro(estimate.price.base)}), arrondi à l'euro supérieur —
                {" "}{formatEuro(estimate.price.tip)} de pourboire pour le chauffeur. Le tarif définitif est
                confirmé par le chauffeur.
              </p>
              <div className="rounded-2xl border border-border p-4 text-sm">
                <p className="font-medium">
                  {form.pickup_address} → {form.dropoff_address}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {formatDateTime(new Date(form.scheduled_at).toISOString())} ·{" "}
                  <Users className="inline size-3.5" /> {form.passengers} passager(s) · {form.luggage} bagage(s)
                  {form.round_trip ? " · aller-retour" : ""}
                </p>
                {form.special_needs ? (
                  <p className="text-muted-foreground">Besoins : {form.special_needs}</p>
                ) : null}
                {form.comment ? <p className="text-muted-foreground">« {form.comment} »</p> : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-border bg-card/95 p-4 backdrop-blur sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0">
          <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>
            <ArrowLeft className="size-4" /> Retour
          </Button>
          {step < 3 ? (
            <Button size="lg" className="rounded-2xl px-6 transition-transform active:scale-95" onClick={next} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {step === 2 ? "Voir l'estimation" : "Continuer"}
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button size="lg" className="rounded-2xl px-6 transition-transform active:scale-95" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Confirmer la demande
            </Button>
          )}
        </div>
      </div>


      <h2 className="mb-3 text-lg font-semibold">Mes demandes</h2>
      {list.length === 0 ? (
        <EmptyState title="Aucune demande" />
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <div key={r.id} className="surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {r.pickup_address} → {r.dropoff_address}
                  </p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(r.scheduled_at)}</p>
                  {["new", "reviewing"].includes(r.status) ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      En attente de confirmation du chauffeur.
                    </p>
                  ) : null}
                  {r.proposed_price || r.proposed_time ? (
                    <p className="mt-1 text-sm">
                      Proposition du chauffeur :{" "}
                      {r.proposed_price ? formatEuro(Number(r.proposed_price)) : "—"}
                      {r.proposed_time ? ` le ${formatDateTime(r.proposed_time)}` : ""}
                    </p>
                  ) : null}
                  {r.driver_message ? (
                    <p className="text-sm text-muted-foreground">« {r.driver_message} »</p>
                  ) : null}
                </div>
                <StatusBadge status={r.status} labels={RIDE_STATUS_LABELS} />
              </div>
              <div className="mt-3 flex gap-2">
                {r.status === "proposal_sent" ? (
                  <Button size="sm" onClick={() => accept(r.id)}>
                    Accepter la proposition
                  </Button>
                ) : null}
                {!["cancelled", "refused", "confirmed", "completed"].includes(r.status) ? (
                  <Button size="sm" variant="outline" onClick={() => cancel(r.id)}>
                    Annuler
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
