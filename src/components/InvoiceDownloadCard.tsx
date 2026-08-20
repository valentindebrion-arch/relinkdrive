import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { INVOICE_LABELS, formatDate, formatEuro } from "@/lib/labels";
import { downloadInvoicePdf, type InvoiceData, type InvoiceIssuer, type InvoiceRide } from "@/lib/invoice-pdf";

export function InvoiceDownloadCard({
  invoice,
  ride,
  driverId,
}: {
  invoice: InvoiceData & { id: string };
  ride?: InvoiceRide | null;
  driverId: string;
}) {
  const { user, profile } = useAuth();
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    try {
      const { data } = await (supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: InvoiceIssuer[] | null }>;
      }).rpc("get_invoice_issuer", { _driver: driverId });
      const issuer: InvoiceIssuer = data?.[0] ?? {};
      downloadInvoicePdf({
        invoice,
        issuer,
        client: {
          full_name: profile?.full_name ?? user?.email ?? null,
          email: profile?.email ?? user?.email ?? null,
          phone: profile?.phone ?? null,
        },
        ride: ride ?? null,
      });
    } catch (e) {
      toast.error("Impossible de générer la facture");
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      className="tap-active flex w-full items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <FileText className="size-5" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {invoice.number ? `Facture ${invoice.number}` : "Reçu de course"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {formatEuro(Number(invoice.amount_ttc))} TTC · {formatDate(invoice.issued_on)} · Télécharger en PDF
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={invoice.status} labels={INVOICE_LABELS} />
        <Download className="size-4 text-muted-foreground" />
      </div>
    </button>
  );
}
