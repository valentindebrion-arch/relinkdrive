/**
 * Conservation des formats : PDF lisible, Factur-X et XML source sont déposés
 * dans le stockage privé du chauffeur avec leur empreinte SHA-256, la version
 * des spécifications et la date de génération. Aucun fichier n'est remplacé :
 * une correction passe par un avoir.
 */
import { supabase } from "@/integrations/supabase/client";
import { buildInvoicePdf, type InvoiceIssuer, type InvoiceRide } from "@/lib/invoice-pdf";
import { buildStructuredInvoice, type InvoiceRow, type StructuredInvoice } from "@/lib/einvoicing/model";
import { buildFacturX } from "@/lib/einvoicing/facturx";
import {
  mergeResults,
  validatePdfXmlConsistency,
  validateStructuredInvoice,
  type ValidationResult,
} from "@/lib/einvoicing/validate";

export async function sha256Hex(bytes: Uint8Array | ArrayBuffer) {
  const buf = bytes instanceof Uint8Array ? (bytes.slice().buffer as ArrayBuffer) : bytes;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const safe = (n: string | null) => (n ?? "brouillon").replace(/[^A-Za-z0-9._-]/g, "-");

export type ArchivedDocument = {
  kind: "pdf" | "facturx" | "xml";
  path: string;
  sha256: string;
  byte_size: number;
  content_type: string;
  spec_version?: string;
  profile?: string;
};

async function upload(path: string, body: Blob, contentType: string) {
  const { error } = await supabase.storage
    .from("invoices")
    .upload(path, body, { contentType, upsert: false });
  if (error && !error.message.toLowerCase().includes("exists")) throw error;
}

export type GenerateOptions = {
  invoice: InvoiceRow & { id: string };
  issuer: InvoiceIssuer;
  client?: { full_name?: string | null; email?: string | null; phone?: string | null } | null;
  ride?: InvoiceRide | null;
  driverId: string;
};

export type GenerateResult = {
  structured: StructuredInvoice;
  validation: ValidationResult;
  documents: ArchivedDocument[];
};

/**
 * Génère PDF + Factur-X + XML depuis la **même** source de données, contrôle la
 * cohérence, puis conserve les trois fichiers avec leurs empreintes.
 * Rien n'est déposé si la validation échoue.
 */
export async function generateAndArchiveInvoiceDocuments(opts: GenerateOptions): Promise<GenerateResult> {
  const structured = buildStructuredInvoice(opts.invoice, opts.ride ?? null);
  const base = validateStructuredInvoice(structured);
  if (!base.valid) return { structured, validation: base, documents: [] };

  const pdfDoc = buildInvoicePdf({
    invoice: opts.invoice as never,
    issuer: opts.issuer,
    client: opts.client ?? null,
    ride: opts.ride ?? null,
  });
  const readable = new Uint8Array(pdfDoc.output("arraybuffer") as ArrayBuffer);
  const facturx = await buildFacturX(structured, readable);

  const consistency = validatePdfXmlConsistency(structured, facturx.xml);
  const validation = mergeResults(base, consistency);
  if (!validation.valid) return { structured, validation, documents: [] };

  const year = new Date(structured.issueDate).getFullYear();
  const stem = `${opts.driverId}/${year}/${safe(structured.number)}`;
  const xmlBytes = new TextEncoder().encode(facturx.xml);

  const documents: ArchivedDocument[] = [
    {
      kind: "pdf",
      path: `${stem}.pdf`,
      sha256: await sha256Hex(readable),
      byte_size: readable.byteLength,
      content_type: "application/pdf",
    },
    {
      kind: "facturx",
      path: `${stem}.facturx.pdf`,
      sha256: await sha256Hex(facturx.pdf),
      byte_size: facturx.pdf.byteLength,
      content_type: "application/pdf",
      spec_version: facturx.specVersion,
      profile: facturx.profile,
    },
    {
      kind: "xml",
      path: `${stem}.xml`,
      sha256: await sha256Hex(xmlBytes),
      byte_size: xmlBytes.byteLength,
      content_type: "application/xml",
      spec_version: facturx.specVersion,
      profile: facturx.profile,
    },
  ];

  await upload(documents[0]!.path, new Blob([readable as BlobPart], { type: "application/pdf" }), "application/pdf");
  await upload(documents[1]!.path, new Blob([facturx.pdf as BlobPart], { type: "application/pdf" }), "application/pdf");
  await upload(documents[2]!.path, new Blob([facturx.xml], { type: "application/xml" }), "application/xml");

  const { error } = await (
    supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }
  ).rpc("record_invoice_documents", { _invoice_id: opts.invoice.id, _docs: documents });
  if (error) throw new Error(error.message);

  return { structured, validation, documents };
}

/** Ouvre un fichier conservé via une URL signée temporaire. */
export async function openStoredDocument(path: string) {
  const { data, error } = await supabase.storage.from("invoices").createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) return false;
  window.open(data.signedUrl, "_blank", "noopener");
  return true;
}
