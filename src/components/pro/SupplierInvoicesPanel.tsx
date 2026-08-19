/**
 * Réception des factures fournisseurs via la plateforme agréée
 * (obligation au 1er septembre 2026).
 */
import { useState } from "react";
import { toast } from "sonner";
import { Download, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatEuro } from "@/lib/labels";
import { openStoredDocument } from "@/lib/einvoicing/documents";
import type { EInvoicingConnection } from "@/lib/einvoicing/connections";
import {
  RECEPTION_STATUS_LABELS,
  syncInboundInvoices,
  useInvalidateSupplierInvoices,
  useSupplierInvoices,
} from "@/lib/einvoicing/reception";

export function SupplierInvoicesPanel({
  driverId,
  connection,
}: {
  driverId: string;
  connection: EInvoicingConnection | null;
}) {
  const invoices = useSupplierInvoices(driverId);
  const invalidate = useInvalidateSupplierInvoices();
  const [busy, setBusy] = useState(false);

  async function sync() {
    if (!connection) {
      toast.error("Connectez une plateforme agréée pour recevoir vos factures fournisseurs.");
      return;
    }
    setBusy(true);
    try {
      const res = await syncInboundInvoices(driverId, connection);
      invalidate();
      if (!res.supported) toast.info("Votre plateforme ne propose pas encore de flux entrant dans ReLink.");
      else toast.success(`${res.imported} facture(s) fournisseur importée(s)`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Factures fournisseurs reçues</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Adresse de réception : {connection?.electronic_billing_address ?? "non configurée"} · Réception{" "}
            {connection?.reception_enabled ? "activée" : "désactivée"}.
          </p>
        </div>
        <Inbox className="size-5 shrink-0 text-muted-foreground" />
      </div>

      <Button size="sm" variant="outline" className="mt-3" disabled={busy} onClick={() => void sync()}>
        <RefreshCw className="mr-1 size-4" /> Synchroniser
      </Button>

      <div className="mt-4 space-y-2">
        {(invoices.data ?? []).map((i) => (
          <div key={i.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {i.supplier_name} · {i.invoice_number ?? "sans numéro"}
              </p>
              <p className="text-xs text-muted-foreground">
                {i.issued_on ? formatDate(i.issued_on) : "—"} ·{" "}
                {i.amount_ttc != null ? `${formatEuro(Number(i.amount_ttc))} TTC` : "montant inconnu"} ·{" "}
                {RECEPTION_STATUS_LABELS[i.reception_status]}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!i.pdf_path}
              onClick={() => void openStoredDocument(i.pdf_path!)}
            >
              <Download className="size-4" />
            </Button>
          </div>
        ))}
        {(invoices.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune facture fournisseur reçue. La récupération automatique reste à raccorder à l'API de votre plateforme
            agréée.
          </p>
        ) : null}
      </div>
    </section>
  );
}
