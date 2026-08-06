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
    <div className="mb-6 flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 items-center gap-2">
          <div
            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              i < step
                ? "bg-primary text-primary-foreground"
                : i === step
                  ? "bg-primary/15 text-primary ring-2 ring-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i < step ? <Check className="size-3.5" /> : i + 1}
          </div>
          <span className={`hidden text-xs font-medium sm:block ${i === step ? "" : "text-muted-foreground"}`}>
            {label}
          </span>
          {i < STEPS.length - 1 ? <div className="h-px flex-1 bg-border" /> : null}
        </div>
      ))}
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
          setEstimate(null);
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
      if (form.pickup_address.trim().length < 3) return toast.error("Adresse de départ requise");
      if (form.dropoff_address.trim().length < 3) return toast.error("Adresse d'arrivée requise");
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

      <div className="surface mb-8 p-5">
        <StepBar step={step} />

        {step === 0 ? (
          <div className="grid gap-4">
            <div>
              <Label htmlFor="drv">Chauffeur</Label>
              <select
                id="drv"
                className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
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
            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-3">
                <span className="size-2.5 rounded-full bg-primary" />
                <Input
                  aria-label="Adresse de départ"
                  className="h-11 border-0 shadow-none focus-visible:ring-0"
                  placeholder="Adresse de départ"
                  maxLength={160}
                  value={form.pickup_address}
                  onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
                />
                <Button variant="ghost" size="icon" onClick={useMyLocation} title="Utiliser ma position">
                  {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
                </Button>
              </div>
              <div className="my-1 ml-1 h-4 w-px bg-border" />
              <div className="flex items-center gap-3">
                <MapPin className="size-3.5 text-muted-foreground" />
                <Input
                  aria-label="Adresse d'arrivée"
                  className="h-11 border-0 shadow-none focus-visible:ring-0"
                  placeholder="Adresse d'arrivée"
                  maxLength={160}
                  value={form.dropoff_address}
                  onChange={(e) => setForm({ ...form, dropoff_address: e.target.value })}
                />
              </div>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="sa">Date et heure du départ</Label>
              <Input
                id="sa"
                type="datetime-local"
                className="mt-1 h-11"
                value={form.scheduled_at}
                onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="tt">Type de trajet</Label>
              <Input
                id="tt"
                className="mt-1 h-11"
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
                className="mt-1 h-11"
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
                className="mt-1 h-11"
                value={form.luggage}
                onChange={(e) => setForm({ ...form, luggage: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border p-3 sm:col-span-2">
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
                className="mt-1 h-11"
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
                className="mt-1"
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
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Distance</p>
                <p className="text-lg font-semibold">{estimate.distanceKm} km</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Durée estimée</p>
                <p className="text-lg font-semibold">~{estimate.durationMin} min</p>
              </div>
              <div className="rounded-xl border border-primary/30 bg-accent p-3">
                <p className="text-xs text-accent-foreground">Prix estimé</p>
                <p className="text-lg font-semibold">{formatEuro(estimate.price.total)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Base 1,90 €/km, minimum 9 € ({formatEuro(estimate.price.base)}), arrondi à l'euro supérieur —
              {" "}{formatEuro(estimate.price.tip)} de pourboire pour le chauffeur. Le tarif définitif est
              confirmé par le chauffeur.
            </p>
            <div className="rounded-xl border border-border p-4 text-sm">
              <p className="font-medium">
                {form.pickup_address} → {form.dropoff_address}
              </p>
              <p className="mt-1 text-muted-foreground">
                {formatDateTime(new Date(form.scheduled_at).toISOString())} ·{" "}
                <Users className="inline size-3.5" /> {form.passengers} passager(s) · {form.luggage} bagage(s)
                {form.round_trip ? " · aller-retour" : ""}
              </p>
              {form.special_needs ? <p className="text-muted-foreground">Besoins : {form.special_needs}</p> : null}
              {form.comment ? <p className="text-muted-foreground">« {form.comment} »</p> : null}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3">
          <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>
            <ArrowLeft className="size-4" /> Retour
          </Button>
          {step < 3 ? (
            <Button onClick={next} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {step === 2 ? "Voir l'estimation" : "Continuer"}
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={busy}>
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
