/**
 * Écran « Vérifier et transmettre la facture ».
 *
 * Récapitule l'émetteur, le client, la destination résolue, le format généré
 * et les contrôles, puis exige une confirmation explicite. Aucun libellé ne
 * laisse entendre un envoi direct à l'administration.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate, formatEuro } from "@/lib/labels";
import { buildStructuredInvoice, type InvoiceRow } from "@/lib/einvoicing/model";
import { FACTURX_PROFILE, FACTURX_SPEC_VERSION } from "@/lib/einvoicing/spec";
import type { EInvoicingConnection } from "@/lib/einvoicing/connections";
import { prepareSubmission, submitInvoice, type PreparedSubmission } from "@/lib/einvoicing/submissions";
import { SUBMISSION_STATUS_LABELS } from "@/lib/einvoicing/provider";

export function SubmitInvoiceDialog({
  open,
  onOpenChange,
  invoice,
  driverId,
  connection,
  facturxPath,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: Record<string, unknown> & { id: string; number: string | null };
  driverId: string;
  connection: EInvoicingConnection | null;
  facturxPath: string | null;
  onDone?: () => void;
}) {
  const [prep, setPrep] = useState<PreparedSubmission | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const doc = buildStructuredInvoice(invoice as unknown as InvoiceRow, null);

  useEffect(() => {
    if (!open) return;
    setConfirmed(false);
    setPrep(null);
    void prepareSubmission({ doc, invoiceId: invoice.id, connection, hasFacturx: !!facturxPath }).then(setPrep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice.id, connection?.id, facturxPath]);

  async function transmit() {
    if (!connection || !prep?.canSubmit || busy) return;
    setBusy(true);
    try {
      const { result } = await submitInvoice({
        driverId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        invoiceVersion: String(invoice["updated_at"] ?? "1"),
        facturxPath,
        connection,
        routingId: prep.routing.routingId ?? null,
      });
      if (result.status === "rejected" || result.status === "technical_error")
        toast.error(result.errorMessage ?? "Transmission en échec");
      else toast.success(`Transmission enregistrée : ${SUBMISSION_STATUS_LABELS[result.status]}`);
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vérifier et transmettre la facture</DialogTitle>
          <DialogDescription>
            La transmission passe par votre plateforme agréée. ReLink ne transmet rien directement à l'administration.
          </DialogDescription>
        </DialogHeader>

        {!prep ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Contrôles en cours…
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <Row label="Émetteur" value={doc.seller.legalName ?? doc.seller.name} />
            <Row label="SIREN émetteur" value={doc.seller.siren ?? "—"} />
            <Row label="Client" value={doc.buyer.name} />
            <Row label="SIREN client" value={doc.buyer.siren ?? "—"} />
            <Row label="Ma plateforme" value={prep.provider.label} />
            <Row
              label="Destination résolue"
              value={
                prep.routing.resolved
                  ? `${prep.routing.routingId ?? "—"}${prep.routing.routingScheme ? ` (${prep.routing.routingScheme})` : ""}`
                  : "Non résolue"
              }
            />
            <Row label="Numéro" value={invoice.number ?? "—"} />
            <Row label="Date d'émission" value={formatDate(doc.issueDate)} />
            <Row label="Montant HT" value={formatEuro(doc.totals.totalHt)} />
            <Row label="TVA" value={formatEuro(doc.totals.totalVat)} />
            <Row label="Total TTC" value={formatEuro(doc.totals.totalTtc)} />
            <Row label="Format généré" value={`Factur-X ${FACTURX_SPEC_VERSION} — profil ${FACTURX_PROFILE}`} />

            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Contrôles</p>
              {prep.validation.errors.length === 0 ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                  <CheckCircle2 className="size-3.5" /> Tous les contrôles bloquants sont passés.
                </p>
              ) : (
                <ul className="mt-1 space-y-1 text-xs text-destructive">
                  {prep.validation.errors.map((e) => (
                    <li key={e.code}>• {e.message}</li>
                  ))}
                </ul>
              )}
              {prep.validation.warnings.length > 0 ? (
                <ul className="mt-1 space-y-1 text-xs text-warning">
                  {prep.validation.warnings.map((w) => (
                    <li key={w.code}>• {w.message}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            {prep.blockingReason ? (
              <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-xs text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {prep.blockingReason}
              </p>
            ) : null}

            {prep.existing ? (
              <p className="text-xs text-muted-foreground">
                Transmission existante : {SUBMISSION_STATUS_LABELS[prep.existing.status]} ·{" "}
                {formatDate(prep.existing.created_at)}
                {prep.existing.external_submission_id ? ` · réf. ${prep.existing.external_submission_id}` : ""}
              </p>
            ) : null}

            {connection?.environment === "sandbox" ? (
              <p className="rounded-xl bg-warning/10 p-2 text-[11px] font-medium text-warning">
                Environnement de test : cette transmission n'a aucune valeur officielle.
              </p>
            ) : null}

            <label className="flex items-start gap-2 text-xs">
              <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
              <span>Je confirme l'exactitude des informations et demande la transmission de cette facture.</span>
            </label>

            <Button className="w-full" disabled={!prep.canSubmit || !confirmed || busy} onClick={() => void transmit()}>
              {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Send className="mr-1 size-4" />}
              Transmettre à ma plateforme agréée
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
