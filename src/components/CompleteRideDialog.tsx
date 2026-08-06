import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PAYMENT_METHODS, formatDateTime, formatEuro } from "@/lib/labels";

export type CompletableRide = {
  id: string;
  client_id: string | null;
  client_label: string | null;
  pickup_address: string;
  dropoff_address: string;
  scheduled_at: string;
  started_at: string | null;
  price: number | null;
};

export function CompleteRideDialog({
  ride,
  open,
  onOpenChange,
}: {
  ride: CompletableRide | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [price, setPrice] = useState("");
  const [method, setMethod] = useState("card");
  const [mileage, setMileage] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!ride) return null;

  const amount = price !== "" ? Number(price) : Number(ride.price ?? 0);

  async function confirm() {
    if (!ride || saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    // Action atomique : la mise à jour est conditionnée au statut courant,
    // ce qui empêche tout double déclenchement (et donc toute facture en double).
    const { data, error } = await supabase
      .from("rides")
      .update({
        status: "completed" as never,
        completed_at: now,
        started_at: ride.started_at ?? now,
        ...(amount > 0 ? { price: amount } : {}),
        payment_method: method,
        ...(mileage ? { mileage_km: Number(mileage) } : {}),
        ...(note ? { completion_note: note } : {}),
      })
      .eq("id", ride.id)
      .neq("status", "completed")
      .select("id");
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data?.length) {
      toast.info("Cette course est déjà terminée.");
      onOpenChange(false);
      return;
    }
    await supabase
      .from("ride_status_history")
      .insert({ ride_id: ride.id, status: "completed" as never, changed_by: user!.id });
    toast.success(
      amount > 0 ? "Course terminée — facture générée automatiquement" : "Course terminée — facture à compléter",
    );
    onOpenChange(false);
    ["driver-active-ride", "driver-rides", "pro-overview", "driver-data", "driver-invoices", "driver-clients"].forEach(
      (key) => void qc.invalidateQueries({ queryKey: [key] }),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Terminer la course</DialogTitle>
          <DialogDescription>Vérifiez le récapitulatif, Relink s'occupe du reste.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1 rounded-xl bg-muted/60 p-3 text-sm">
          <p className="font-medium">{ride.client_label ?? "Client"}</p>
          <p className="text-muted-foreground">Départ : {ride.pickup_address}</p>
          <p className="text-muted-foreground">Destination : {ride.dropoff_address}</p>
          <p className="text-muted-foreground">Début : {formatDateTime(ride.started_at ?? ride.scheduled_at)}</p>
          <p className="text-muted-foreground">Fin : {formatDateTime(new Date().toISOString())}</p>
        </div>

        <div className="grid gap-3">
          <div>
            <Label htmlFor="final-price">Montant final (€)</Label>
            <Input
              id="final-price"
              type="number"
              min="0"
              step="0.5"
              placeholder={ride.price ? String(ride.price) : "Ex. 24"}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            {amount > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">Facture générée pour {formatEuro(amount)}.</p>
            ) : (
              <p className="mt-1 text-xs text-warning">
                Sans montant, la facture sera créée en « Brouillon à compléter ».
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="method">Moyen de paiement</Label>
            <select
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="km">Kilométrage (facultatif)</Label>
            <Input id="km" type="number" min="0" value={mileage} onChange={(e) => setMileage(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="note">Remarque (facultatif)</Label>
            <Textarea id="note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button className="w-full" size="lg" disabled={saving} onClick={confirm}>
            {saving ? "Enregistrement…" : "Confirmer la fin de la course"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
