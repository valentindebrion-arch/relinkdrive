import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime, formatEuro } from "@/lib/labels";

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

/**
 * Clôture en une seule action : aucune saisie manuelle (kilométrage, mode de
 * règlement). Les données déjà enregistrées sur la course sont utilisées telles
 * quelles, et la facture est émise automatiquement.
 */
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
  const [saving, setSaving] = useState(false);

  if (!ride) return null;

  const amount = Number(ride.price ?? 0);

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
    toast.success(amount > 0 ? "Course terminée — facture émise" : "Course terminée — facture à compléter");
    onOpenChange(false);
    ["driver-board", "driver-active-ride", "driver-rides", "pro-overview", "driver-data", "driver-invoices", "driver-clients"].forEach(
      (key) => void qc.invalidateQueries({ queryKey: [key] }),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Terminer cette course ?</DialogTitle>
          <DialogDescription>
            La course sera clôturée et la facture définitive sera automatiquement émise.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 rounded-xl bg-muted/60 p-3 text-sm">
          <p className="font-medium">{ride.client_label ?? "Client"}</p>
          <p className="text-muted-foreground">Départ : {ride.pickup_address}</p>
          <p className="text-muted-foreground">Destination : {ride.dropoff_address}</p>
          <p className="text-muted-foreground">Début : {formatDateTime(ride.started_at ?? ride.scheduled_at)}</p>
          <p className="mt-2 text-base font-semibold text-foreground">{formatEuro(amount)}</p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button size="lg" disabled={saving} onClick={confirm}>
            {saving ? "Clôture…" : "Confirmer la fin de course"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
