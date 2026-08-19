/**
 * Réception des factures fournisseurs (obligation au 1er septembre 2026).
 *
 * Le modèle et l'interface sont en place. La récupération automatique dépend
 * de l'API de la plateforme agréée retenue : tant qu'aucun connecteur réel
 * n'expose de flux entrant, la synchronisation ne ramène rien et l'interface
 * l'indique explicitement.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { connectionContext, type EInvoicingConnection } from "@/lib/einvoicing/connections";
import { getProvider } from "@/lib/einvoicing/provider";

export type SupplierInvoice = {
  id: string;
  provider_key: string | null;
  external_id: string | null;
  supplier_name: string;
  supplier_siren: string | null;
  invoice_number: string | null;
  issued_on: string | null;
  due_on: string | null;
  amount_ht: number | null;
  amount_vat: number | null;
  amount_ttc: number | null;
  currency: string;
  reception_status: "received" | "read" | "approved" | "disputed" | "paid";
  pdf_path: string | null;
  structured_path: string | null;
  structured_format: string | null;
  received_at: string;
};

export const RECEPTION_STATUS_LABELS: Record<SupplierInvoice["reception_status"], string> = {
  received: "Reçue",
  read: "Consultée",
  approved: "Approuvée",
  disputed: "Contestée",
  paid: "Payée",
};

export function useSupplierInvoices(driverId?: string) {
  return useQuery({
    queryKey: ["supplier-invoices", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_invoices")
        .select("*")
        .eq("driver_id", driverId!)
        .order("received_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SupplierInvoice[];
    },
  });
}

/** Retourne le nombre de factures importées (0 si la plateforme n'expose pas de flux entrant). */
export async function syncInboundInvoices(driverId: string, connection: EInvoicingConnection) {
  const provider = getProvider(connection.provider_key);
  if (!provider.supportsReception) return { supported: false, imported: 0 };
  const inbound = await provider.fetchInboundInvoices(connectionContext(connection));
  if (inbound.length === 0) return { supported: true, imported: 0 };

  const rows = inbound.map((i) => ({
    driver_id: driverId,
    provider_key: provider.key,
    environment: connection.environment,
    external_id: i.externalId,
    supplier_name: i.supplierName,
    supplier_siren: i.supplierSiren ?? null,
    invoice_number: i.invoiceNumber ?? null,
    issued_on: i.issuedOn ?? null,
    due_on: i.dueOn ?? null,
    amount_ht: i.amountHt ?? null,
    amount_vat: i.amountVat ?? null,
    amount_ttc: i.amountTtc ?? null,
    structured_format: i.structuredFormat ?? null,
  }));
  const { error } = await supabase
    .from("supplier_invoices")
    .upsert(rows as never, { onConflict: "driver_id,provider_key,external_id" });
  if (error) throw error;

  await supabase
    .from("e_invoicing_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", connection.id);
  return { supported: true, imported: rows.length };
}

export function useInvalidateSupplierInvoices() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ["supplier-invoices"] });
}
