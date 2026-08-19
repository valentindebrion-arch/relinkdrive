/**
 * Architecture « Plateforme Agréée » (PA).
 *
 * Le dispositif français repose sur des plateformes agréées : ReLink ne
 * transmet jamais en direct vers l'administration. Le code ci-dessous isole le
 * connecteur derrière une interface stable pour qu'un raccordement réel (API
 * d'un PA) remplace le canal de secours sans toucher au reste du module.
 *
 * Tant qu'aucun PA n'est raccordé, le canal actif est `manual_file` : le
 * chauffeur récupère le Factur-X conservé et le dépose chez son PA. Chaque
 * échange (envoi, accusé, rejet, encaissement) est journalisé dans
 * `invoice_transmissions`, ce qui fournit la piste d'audit fiable et durable.
 */
import { supabase } from "@/integrations/supabase/client";

export type TransmissionChannel = "manual_file" | "pa_api" | "email";
export type TransmissionStatus =
  | "pending"
  | "ready"
  | "sent"
  | "delivered"
  | "accepted"
  | "rejected"
  | "cashed"
  | "failed";

export const TRANSMISSION_STATUS_LABELS: Record<TransmissionStatus, string> = {
  pending: "À transmettre",
  ready: "Prête à transmettre",
  sent: "Déposée",
  delivered: "Reçue par le destinataire",
  accepted: "Acceptée",
  rejected: "Refusée",
  cashed: "Encaissée",
  failed: "Échec de transmission",
};

/** Statuts « cycle de vie » exigés par le dispositif, dans l'ordre d'avancement. */
export const LIFECYCLE_ORDER: TransmissionStatus[] = [
  "pending",
  "ready",
  "sent",
  "delivered",
  "accepted",
  "cashed",
];

export type TransmissionInput = {
  invoiceId: string;
  channel: TransmissionChannel;
  status: TransmissionStatus;
  paProvider?: string | null;
  externalId?: string | null;
  ackCode?: string | null;
  ackMessage?: string | null;
  detail?: Record<string, unknown>;
};

export async function recordTransmission(input: TransmissionInput) {
  const { error } = await (
    supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }
  ).rpc("record_invoice_transmission", {
    _invoice_id: input.invoiceId,
    _channel: input.channel,
    _status: input.status,
    _pa_provider: input.paProvider ?? undefined,
    _external_id: input.externalId ?? undefined,
    _ack_code: input.ackCode ?? undefined,
    _ack_message: input.ackMessage ?? undefined,
    _detail: input.detail ?? undefined,
  });
  if (error) throw new Error(error.message);
}

export type PlatformConnector = {
  id: string;
  label: string;
  /** Un connecteur non raccordé ne peut pas envoyer automatiquement. */
  automatic: boolean;
  send: (args: { invoiceId: string; facturxPath: string | null }) => Promise<{ status: TransmissionStatus }>;
};

/**
 * Connecteur de secours conforme au fonctionnement autorisé avant raccordement :
 * dépôt manuel du Factur-X chez la plateforme agréée du chauffeur, tracé ici.
 */
export const manualConnector: PlatformConnector = {
  id: "manual_file",
  label: "Dépôt manuel chez ma plateforme agréée",
  automatic: false,
  async send({ invoiceId, facturxPath }) {
    await recordTransmission({
      invoiceId,
      channel: "manual_file",
      status: "sent",
      detail: { facturx_path: facturxPath, mode: "manual" },
    });
    return { status: "sent" };
  },
};

/** Sélection du connecteur actif selon la configuration de l'entreprise. */
export function resolveConnector(company?: { pa_provider?: string | null; pa_status?: string | null } | null) {
  if (company?.pa_provider && company.pa_status === "connected") {
    return {
      ...manualConnector,
      id: company.pa_provider,
      label: `Transmission via ${company.pa_provider}`,
      automatic: false,
    } satisfies PlatformConnector;
  }
  return manualConnector;
}

/** Déclaration e-reporting (B2C, international, encaissements). */
export async function queueEreporting(invoiceId: string, kind: "b2c" | "payment" | "international") {
  const { error } = await (
    supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }
  ).rpc("queue_ereporting", { _invoice_id: invoiceId, _kind: kind });
  if (error) throw new Error(error.message);
}
