import { supabase } from "@/integrations/supabase/client";
import { buildInvoicePdf, invoiceFileName, type InvoiceIssuer } from "@/lib/invoice-pdf";

/**
 * Conservation légale : le PDF réellement émis est archivé tel quel dans un
 * bucket privé (`invoices/<driver_id>/<année>/<numéro>.pdf`). Le fichier n'est
 * jamais remplacé : toute correction passe par un avoir.
 */
export async function archiveInvoicePdf(
  opts: Parameters<typeof buildInvoicePdf>[0] & { invoice: { id?: string } },
  driverId: string,
  invoiceId: string,
) {
  const doc = buildInvoicePdf(opts);
  const blob = doc.output("blob") as Blob;
  const year = new Date(opts.invoice.issued_on).getFullYear();
  const path = `${driverId}/${year}/${invoiceFileName(opts.invoice.number)}`;
  const { error } = await supabase.storage
    .from("invoices")
    .upload(path, blob, { contentType: "application/pdf", upsert: false });
  if (error && !error.message.toLowerCase().includes("exists")) return null;
  await supabase.from("invoices").update({ pdf_path: path }).eq("id", invoiceId);
  return path;
}

/** Récupère le PDF archivé si présent, sinon null (fallback : regénération). */
export async function openArchivedInvoicePdf(path: string) {
  const { data, error } = await supabase.storage.from("invoices").createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) return false;
  window.open(data.signedUrl, "_blank", "noopener");
  return true;
}

export async function fetchInvoiceIssuer(driverId: string): Promise<InvoiceIssuer> {
  const { data } = await (
    supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: InvoiceIssuer[] | null }>;
    }
  ).rpc("get_invoice_issuer", { _driver: driverId });
  return data?.[0] ?? {};
}
