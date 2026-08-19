/**
 * Transmission d'une facture vers la plateforme agréée du chauffeur.
 *
 * Chaîne complète : validation → routage → création idempotente → envoi →
 * accusé → statut → conservation de la preuve. Aucun envoi n'est réputé
 * « accepté » sans accusé du fournisseur.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sha256Hex } from "@/lib/einvoicing/documents";
import { notifyEinvoicing } from "@/lib/einvoicing/notify";
import {
  buildIdempotencyKey,
  getProvider,
  type EInvoicingProvider,
  type RecipientResolution,
  type SubmissionStatus,
  type SubmitResult,
} from "@/lib/einvoicing/provider";
import { connectionContext, type EInvoicingConnection } from "@/lib/einvoicing/connections";
import { validateRouting, validateStructuredInvoice, mergeResults, type ValidationResult } from "@/lib/einvoicing/validate";
import type { StructuredInvoice } from "@/lib/einvoicing/model";

export type InvoiceSubmission = {
  id: string;
  invoice_id: string;
  provider_key: string;
  environment: string;
  external_submission_id: string | null;
  recipient_routing_id: string | null;
  submitted_format: string;
  status: SubmissionStatus;
  attempt_number: number;
  idempotency_key: string;
  submitted_at: string | null;
  acknowledged_at: string | null;
  delivered_at: string | null;
  rejected_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  receipt_storage_path: string | null;
  created_at: string;
};

export function useInvoiceSubmissions(invoiceId?: string | null) {
  return useQuery({
    queryKey: ["invoice-submissions", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_submissions")
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceSubmission[];
    },
  });
}

export function useDriverSubmissions(driverId?: string) {
  return useQuery({
    queryKey: ["driver-submissions", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_submissions")
        .select("*")
        .eq("driver_id", driverId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceSubmission[];
    },
  });
}

export function useSubmissionEvents(submissionId?: string | null) {
  return useQuery({
    queryKey: ["submission-events", submissionId],
    enabled: !!submissionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_submission_events")
        .select("*")
        .eq("submission_id", submissionId!)
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

async function recordEvent(args: {
  submissionId: string;
  driverId: string;
  type: string;
  externalEventId?: string | null;
  payloadHash?: string | null;
  payloadPath?: string | null;
  detail?: Record<string, unknown>;
}) {
  await supabase.from("invoice_submission_events").insert({
    submission_id: args.submissionId,
    driver_id: args.driverId,
    event_type: args.type,
    external_event_id: args.externalEventId ?? null,
    payload_hash: args.payloadHash ?? null,
    payload_storage_path: args.payloadPath ?? null,
    detail: (args.detail ?? null) as never,
  });
}

/** Conservation de l'accusé dans le stockage privé (non remplaçable depuis l'UI). */
async function storeReceipt(driverId: string, submissionId: string, receipt: { content: string; contentType: string }) {
  const path = `${driverId}/receipts/${submissionId}-${Date.now()}.json`;
  const bytes = new TextEncoder().encode(receipt.content);
  const { error } = await supabase.storage
    .from("invoices")
    .upload(path, new Blob([receipt.content], { type: receipt.contentType }), {
      contentType: receipt.contentType,
      upsert: false,
    });
  if (error) return { path: null, hash: null };
  return { path, hash: await sha256Hex(bytes) };
}

export type PreparedSubmission = {
  provider: EInvoicingProvider;
  routing: RecipientResolution;
  validation: ValidationResult;
  canSubmit: boolean;
  blockingReason?: string | undefined;
  existing?: InvoiceSubmission | null | undefined;
};

/** Contrôles complets avant l'écran de confirmation. */
export async function prepareSubmission(args: {
  doc: StructuredInvoice;
  invoiceId: string;
  connection: EInvoicingConnection | null;
  hasFacturx: boolean;
}): Promise<PreparedSubmission> {
  const provider = getProvider(args.connection?.provider_key);
  const validation = mergeResults(validateStructuredInvoice(args.doc), validateRouting(args.doc));

  const { data: existingRows } = await supabase
    .from("invoice_submissions")
    .select("*")
    .eq("invoice_id", args.invoiceId)
    .order("created_at", { ascending: false });
  const existing = ((existingRows ?? []) as unknown as InvoiceSubmission[])[0] ?? null;
  const alreadySent = ((existingRows ?? []) as unknown as InvoiceSubmission[]).some((s) =>
    ["submitted", "acknowledged", "delivered"].includes(s.status),
  );

  let routing: RecipientResolution = { resolved: false, reason: "Routage non résolu." };
  if (args.connection && args.connection.connection_status === "connected") {
    routing = await provider.resolveRecipient(connectionContext(args.connection), {
      countryCode: args.doc.buyer.countryCode,
      siren: args.doc.buyer.siren ?? null,
      einvoicingAddress: args.doc.buyer.einvoicingAddress ?? null,
      routingId: args.doc.buyer.routingId ?? null,
    });
  }

  let blockingReason: string | undefined;
  if (!args.connection || args.connection.connection_status !== "connected")
    blockingReason = "Connexion à une plateforme agréée nécessaire pour transmettre cette facture.";
  else if (args.doc.buyer.kind !== "company_fr")
    blockingReason =
      "Seules les factures adressées à une entreprise française relèvent du routage B2B. Les autres opérations relèvent de l'e-reporting.";
  else if (!args.hasFacturx) blockingReason = "Le fichier Factur-X n'a pas encore été conservé pour cette facture.";
  else if (!validation.valid) blockingReason = "Des contrôles bloquants doivent être corrigés.";
  else if (!routing.resolved) blockingReason = routing.reason ?? "Destinataire introuvable.";
  else if (alreadySent) blockingReason = "Cette facture a déjà été transmise avec succès.";

  return { provider, routing, validation, canSubmit: !blockingReason, blockingReason, existing };
}

function statusTimestamps(status: SubmissionStatus) {
  const now = new Date().toISOString();
  return {
    submitted_at: ["submitted", "acknowledged", "delivered"].includes(status) ? now : null,
    acknowledged_at: ["acknowledged", "delivered"].includes(status) ? now : null,
    delivered_at: status === "delivered" ? now : null,
    rejected_at: status === "rejected" ? now : null,
  };
}

/**
 * Transmission idempotente. Un double clic, un rechargement ou une erreur
 * réseau après envoi ne créent jamais de doublon : la clé d'idempotence
 * retourne la transmission existante, dont le statut est ensuite réinterrogé.
 */
export async function submitInvoice(args: {
  driverId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  invoiceVersion: number | string;
  facturxPath: string | null;
  connection: EInvoicingConnection;
  routingId: string | null;
}): Promise<{ submission: InvoiceSubmission; result: SubmitResult }> {
  const provider = getProvider(args.connection.provider_key);
  const ctx = connectionContext(args.connection);
  const idempotencyKey = buildIdempotencyKey({
    invoiceId: args.invoiceId,
    invoiceNumber: args.invoiceNumber,
    version: args.invoiceVersion,
    providerKey: provider.key,
    environment: args.connection.environment,
  });

  const { data: created, error } = await supabase.rpc("start_invoice_submission", {
    _invoice_id: args.invoiceId,
    _provider_key: provider.key,
    _environment: args.connection.environment,
    _routing_id: args.routingId,
    _format: "facturx_en16931",
    _idempotency_key: idempotencyKey,
  } as never);
  if (error) throw new Error(error.message);
  const submission = created as unknown as InvoiceSubmission;

  // Transmission déjà partie : on interroge le fournisseur au lieu de renvoyer.
  if (submission.external_submission_id && submission.status !== "queued") {
    const status = await provider.getInvoiceStatus(ctx, submission.external_submission_id);
    await applyResult(args.driverId, submission, status);
    return { submission, result: status };
  }

  let result: SubmitResult;
  try {
    result = await provider.submitInvoice(ctx, {
      invoiceId: args.invoiceId,
      invoiceNumber: args.invoiceNumber,
      idempotencyKey,
      facturxPath: args.facturxPath,
      routingId: args.routingId,
    });
  } catch (e) {
    // Résultat incertain : on ne recrée jamais un envoi, on marque l'incident.
    result = {
      status: "technical_error",
      errorCode: "NETWORK",
      errorMessage: `Résultat incertain (${(e as Error).message}). Le statut sera vérifié auprès de la plateforme avant tout nouvel envoi.`,
    };
  }

  await applyResult(args.driverId, submission, result);
  return { submission, result };
}

async function applyResult(driverId: string, submission: InvoiceSubmission, result: SubmitResult) {
  let receiptPath: string | null = null;
  let receiptHash: string | null = null;
  if (result.receipt) {
    const stored = await storeReceipt(driverId, submission.id, result.receipt);
    receiptPath = stored.path;
    receiptHash = stored.hash;
  }

  await supabase
    .from("invoice_submissions")
    .update({
      status: result.status,
      external_submission_id: result.externalId ?? submission.external_submission_id,
      last_error_code: result.errorCode ?? null,
      last_error_message: result.errorMessage ?? null,
      receipt_storage_path: receiptPath ?? submission.receipt_storage_path,
      ...statusTimestamps(result.status),
    } as never)
    .eq("id", submission.id);

  await recordEvent({
    submissionId: submission.id,
    driverId,
    type: result.status,
    externalEventId: result.externalId ?? null,
    payloadHash: receiptHash,
    payloadPath: receiptPath,
    detail: { error_code: result.errorCode ?? null, error_message: result.errorMessage ?? null },
  });

  if (result.status === "submitted") await notifyEinvoicing(driverId, "invoice_submitted");
  if (result.status === "acknowledged") await notifyEinvoicing(driverId, "invoice_acknowledged");
  if (result.status === "delivered") await notifyEinvoicing(driverId, "invoice_delivered");
  if (result.status === "rejected")
    await notifyEinvoicing(driverId, "invoice_rejected", result.errorMessage ?? undefined);
}

/** Récupération manuelle du statut et de l'accusé auprès du fournisseur. */
export async function refreshSubmission(driverId: string, submission: InvoiceSubmission, connection: EInvoicingConnection) {
  const provider = getProvider(connection.provider_key);
  if (!submission.external_submission_id) return null;
  const result = await provider.getInvoiceStatus(connectionContext(connection), submission.external_submission_id);
  if (!result.receipt) {
    const receipt = await provider.getSubmissionReceipt(connectionContext(connection), submission.external_submission_id);
    if (receipt) result.receipt = receipt;
  }
  await applyResult(driverId, submission, result);
  return result;
}

export async function cancelSubmission(driverId: string, submission: InvoiceSubmission, connection: EInvoicingConnection) {
  const provider = getProvider(connection.provider_key);
  if (submission.external_submission_id)
    await provider.cancelPendingSubmission(connectionContext(connection), submission.external_submission_id);
  await supabase
    .from("invoice_submissions")
    .update({ status: "cancelled_before_submission" } as never)
    .eq("id", submission.id);
  await recordEvent({ submissionId: submission.id, driverId, type: "cancelled_before_submission" });
}

export function useInvalidateSubmissions() {
  const qc = useQueryClient();
  return (invoiceId?: string) => {
    void qc.invalidateQueries({ queryKey: ["invoice-submissions", invoiceId] });
    void qc.invalidateQueries({ queryKey: ["driver-submissions"] });
  };
}
