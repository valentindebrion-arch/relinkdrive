import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, formatDateTime, formatEuro } from "@/lib/labels";
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

const schema = z.object({
  driver_id: z.string().uuid({ message: "Choisissez un chauffeur" }),
  pickup_address: z.string().trim().min(3, "Adresse de départ requise").max(160),
  dropoff_address: z.string().trim().min(3, "Adresse d'arrivée requise").max(160),
  scheduled_at: z.string().min(1, "Date et heure requises"),
  passengers: z.number().min(1).max(8),
  luggage: z.number().min(0).max(10),
  comment: z.string().max(500).optional(),
  special_needs: z.string().max(200).optional(),
});

function ClientRequests() {
  const { user } = useAuth();
  const search = Route.useSearch();
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

  const drivers = useQuery({
    queryKey: ["client-driver-options", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: conns } = await supabase.from("driver_client_connections").select("driver_id").eq("client_id", user!.id);
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

  async function submit() {
    const parsed = schema.safeParse({
      driver_id: form.driver_id,
      pickup_address: form.pickup_address,
      dropoff_address: form.dropoff_address,
      scheduled_at: form.scheduled_at,
      passengers: Number(form.passengers),
      luggage: Number(form.luggage),
      comment: form.comment,
      special_needs: form.special_needs,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }
    const { error } = await supabase.from("ride_requests").insert({
      client_id: user!.id,
      driver_id: parsed.data.driver_id,
      pickup_address: parsed.data.pickup_address,
      dropoff_address: parsed.data.dropoff_address,
      scheduled_at: new Date(parsed.data.scheduled_at).toISOString(),
      passengers: parsed.data.passengers,
      luggage: parsed.data.luggage,
      comment: parsed.data.comment || null,
      special_needs: parsed.data.special_needs || null,
      round_trip: form.round_trip,
      trip_type: form.trip_type || null,
      status: "new",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("notifications").insert({
      user_id: parsed.data.driver_id,
      title: "Nouvelle demande de trajet",
      body: `${parsed.data.pickup_address} → ${parsed.data.dropoff_address}`,
      kind: "request",
      link: "/pro/demandes",
    });
    toast.success("Demande envoyée");
    setForm({ ...form, pickup_address: "", dropoff_address: "", scheduled_at: "", comment: "", special_needs: "" });
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
      <PageHeader title="Mes demandes" description="Envoyez une demande à l'un de vos chauffeurs." />

      <div className="surface mb-6 grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="drv">Chauffeur</Label>
          <select
            id="drv"
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
        <div>
          <Label htmlFor="pu">Adresse de départ</Label>
          <Input id="pu" value={form.pickup_address} maxLength={160} onChange={(e) => setForm({ ...form, pickup_address: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="do">Adresse d'arrivée</Label>
          <Input id="do" value={form.dropoff_address} maxLength={160} onChange={(e) => setForm({ ...form, dropoff_address: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="sa">Date et heure</Label>
          <Input id="sa" type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="tt">Type de trajet</Label>
          <Input id="tt" value={form.trip_type} maxLength={60} placeholder="Aéroport, gare, événement…" onChange={(e) => setForm({ ...form, trip_type: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="pa">Passagers</Label>
          <Input id="pa" type="number" min="1" max="8" value={form.passengers} onChange={(e) => setForm({ ...form, passengers: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="lu">Bagages</Label>
          <Input id="lu" type="number" min="0" max="10" value={form.luggage} onChange={(e) => setForm({ ...form, luggage: e.target.value })} />
        </div>
        <div className="flex items-center gap-3">
          <Switch id="rt" checked={form.round_trip} onCheckedChange={(v) => setForm({ ...form, round_trip: v })} />
          <Label htmlFor="rt">Aller-retour</Label>
        </div>
        <div>
          <Label htmlFor="sn">Besoins particuliers</Label>
          <Input id="sn" value={form.special_needs} maxLength={200} placeholder="Siège enfant, PMR…" onChange={(e) => setForm({ ...form, special_needs: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="co">Commentaire</Label>
          <Textarea id="co" value={form.comment} maxLength={500} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={submit}>Envoyer la demande</Button>
        </div>
      </div>

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
                  {r.proposed_price || r.proposed_time ? (
                    <p className="mt-1 text-sm">
                      Proposition du chauffeur :{" "}
                      {r.proposed_price ? formatEuro(Number(r.proposed_price)) : "—"}
                      {r.proposed_time ? ` le ${formatDateTime(r.proposed_time)}` : ""}
                    </p>
                  ) : null}
                  {r.driver_message ? <p className="text-sm text-muted-foreground">« {r.driver_message} »</p> : null}
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
