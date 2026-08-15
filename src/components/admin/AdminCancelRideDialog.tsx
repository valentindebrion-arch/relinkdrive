import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ADMIN_CANCEL_REASONS, ADMIN_RIDES_KEY, adminCancelRide } from "@/lib/admin-rides";

export function AdminCancelRideDialog({
  open,
  onOpenChange,
  rideId,
  status,
  onCancelled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rideId: string;
  status: string;
  onCancelled?: () => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const commentRequired = reason === "other";
  const started = status === "in_progress" || status === "client_onboard";
  const canSubmit =
    !busy && !!reason && confirmed && (!commentRequired || comment.trim().length > 0);

  function reset() {
    setReason("");
    setComment("");
    setConfirmed(false);
  }

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const res = await adminCancelRide(rideId, reason, comment.trim() || null);
      if (res.already) {
        toast.info("Cette course était déjà annulée.");
      } else {
        toast.success("La course a été annulée pour le client et le chauffeur.");
      }
      await qc.invalidateQueries({ queryKey: ADMIN_RIDES_KEY });
      await qc.invalidateQueries({ queryKey: ["admin", "ride-detail", rideId] });
      reset();
      onOpenChange(false);
      onCancelled?.();
    } catch (e) {
      // Aucun faux état annulé : la course reste telle quelle et l'erreur réelle s'affiche.
      toast.error(e instanceof Error ? e.message : "L'annulation a échoué");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Annuler cette course pour le client et le chauffeur ?</DialogTitle>
          <DialogDescription>
            Cette action interrompra la course dans ReLink, la retirera des courses en cours des deux
            utilisateurs et la classera dans les courses annulées.
          </DialogDescription>
        </DialogHeader>

        {started ? (
          <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p>
              Cette course est indiquée comme déjà commencée. Vérifiez la situation avec le client et le
              chauffeur avant de l'interrompre dans ReLink.
            </p>
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Motif d'annulation *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un motif" />
              </SelectTrigger>
              <SelectContent>
                {ADMIN_CANCEL_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Commentaire administratif {commentRequired ? "*" : "(facultatif)"}</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Interne : non visible par le client ni le chauffeur."
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
            <span>Je confirme l'annulation de cette course pour les deux parties.</span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Retour
          </Button>
          <Button variant="destructive" disabled={!canSubmit} onClick={submit}>
            {busy ? "Annulation en cours…" : "Confirmer l'annulation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
