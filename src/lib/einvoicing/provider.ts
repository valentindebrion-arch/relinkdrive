/**
 * Couche d'abstraction « plateforme agréée » (PA).
 *
 * ReLink **n'est pas** une plateforme agréée : le chauffeur choisit sa PA, et
 * ReLink s'y raccorde. Toute logique fournisseur passe par cette interface —
 * aucun composant d'interface ne connaît le détail d'une plateforme.
 *
 * Aucun connecteur de production réel n'est disponible à ce jour : les
 * connecteurs livrés sont soit un dépôt manuel tracé, soit un bac à sable
 * clairement identifié comme simulation. Aucun d'eux ne produit d'accusé
 * officiel ni ne permet d'afficher une conformité réglementaire.
 */

export type ProviderEnvironment = "sandbox" | "production";

export type SubmissionStatus =
  | "not_ready"
  | "ready"
  | "validation_failed"
  | "awaiting_confirmation"
  | "queued"
  | "submitted"
  | "acknowledged"
  | "delivered"
  | "rejected"
  | "technical_error"
  | "cancelled_before_submission";

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  not_ready: "Données incomplètes",
  ready: "Prête à transmettre",
  validation_failed: "Contrôles en échec",
  awaiting_confirmation: "En attente de votre confirmation",
  queued: "En file d'attente",
  submitted: "Transmise à ma plateforme",
  acknowledged: "Accusé reçu de la plateforme",
  delivered: "Livrée au destinataire",
  rejected: "Rejetée",
  technical_error: "Erreur technique",
  cancelled_before_submission: "Annulée avant transmission",
};

/** Statuts considérés comme aboutis : interdisent un second envoi. */
export const FINAL_SENT_STATUSES: SubmissionStatus[] = ["submitted", "acknowledged", "delivered"];

export type ConnectionContext = {
  providerKey: string;
  environment: ProviderEnvironment;
  externalAccountId?: string | null;
  electronicBillingAddress?: string | null;
  /** Référence opaque du secret (jamais le secret lui-même côté client). */
  credentialsReference?: string | null;
};

export type RecipientResolution = {
  resolved: boolean;
  routingId?: string | null;
  routingScheme?: string | null;
  recipientPlatform?: string | null;
  reason?: string;
};

export type ProviderReceipt = {
  content: string;
  contentType: string;
  externalEventId?: string | null;
};

export type SubmitResult = {
  status: SubmissionStatus;
  externalId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  receipt?: ProviderReceipt | null;
};

export type ReportPayload = {
  kind: "transaction" | "payment";
  periodStart: string;
  periodEnd: string;
  currency: string;
  totals: { totalHt: number; totalVat: number; totalTtc: number; count: number };
  aggregates: unknown;
};

export type InboundInvoice = {
  externalId: string;
  supplierName: string;
  supplierSiren?: string | null;
  invoiceNumber?: string | null;
  issuedOn?: string | null;
  dueOn?: string | null;
  amountHt?: number | null;
  amountVat?: number | null;
  amountTtc?: number | null;
  structuredFormat?: string | null;
};

export interface EInvoicingProvider {
  key: string;
  label: string;
  description: string;
  /** true seulement pour un raccordement API réel. */
  automatic: boolean;
  /** Connecteur de test : ses transmissions ne valent jamais preuve. */
  simulation: boolean;
  supportsSandbox: boolean;
  supportsReception: boolean;
  supportsTransactionReporting: boolean;
  supportsPaymentReporting: boolean;

  connect(ctx: ConnectionContext): Promise<{ status: "connected" | "pending" | "error"; message?: string }>;
  disconnect(ctx: ConnectionContext): Promise<void>;
  testConnection(ctx: ConnectionContext): Promise<{ ok: boolean; message: string }>;
  resolveRecipient(
    ctx: ConnectionContext,
    buyer: { countryCode: string; siren?: string | null; einvoicingAddress?: string | null; routingId?: string | null },
  ): Promise<RecipientResolution>;
  submitInvoice(
    ctx: ConnectionContext,
    args: { invoiceId: string; invoiceNumber: string | null; idempotencyKey: string; facturxPath: string | null; routingId?: string | null },
  ): Promise<SubmitResult>;
  submitTransactionReport(ctx: ConnectionContext, payload: ReportPayload): Promise<SubmitResult>;
  submitPaymentReport(ctx: ConnectionContext, payload: ReportPayload): Promise<SubmitResult>;
  getInvoiceStatus(ctx: ConnectionContext, externalId: string): Promise<SubmitResult>;
  getSubmissionReceipt(ctx: ConnectionContext, externalId: string): Promise<ProviderReceipt | null>;
  cancelPendingSubmission(ctx: ConnectionContext, externalId: string): Promise<{ cancelled: boolean; message: string }>;
  fetchInboundInvoices(ctx: ConnectionContext): Promise<InboundInvoice[]>;
}

const notConnected = (label: string): SubmitResult => ({
  status: "not_ready",
  errorCode: "NO_PLATFORM",
  errorMessage: `Connexion à une plateforme agréée nécessaire pour transmettre cette facture (${label}).`,
});

/**
 * Dépôt manuel : le chauffeur télécharge le Factur-X conservé et le dépose
 * lui-même chez sa plateforme agréée. ReLink journalise l'opération sans
 * prétendre à une transmission automatique.
 */
export const manualDepositProvider: EInvoicingProvider = {
  key: "manual_deposit",
  label: "Dépôt manuel chez ma plateforme agréée",
  description:
    "Aucun raccordement API. Vous téléchargez le fichier Factur-X et le déposez vous-même sur le portail de votre plateforme agréée. ReLink conserve la trace de l'opération.",
  automatic: false,
  simulation: false,
  supportsSandbox: false,
  supportsReception: false,
  supportsTransactionReporting: false,
  supportsPaymentReporting: false,
  async connect() {
    return { status: "connected", message: "Mode dépôt manuel activé." };
  },
  async disconnect() {},
  async testConnection() {
    return { ok: true, message: "Mode dépôt manuel : aucun échange automatique n'est effectué." };
  },
  async resolveRecipient(_ctx, buyer) {
    if (buyer.einvoicingAddress || buyer.routingId)
      return {
        resolved: true,
        routingId: buyer.routingId ?? buyer.einvoicingAddress ?? null,
        routingScheme: "manual",
        recipientPlatform: null,
      };
    return { resolved: false, reason: "Adresse électronique de facturation du client inconnue." };
  },
  async submitInvoice(_ctx, args) {
    return {
      status: "queued",
      externalId: null,
      errorCode: "MANUAL_DEPOSIT",
      errorMessage:
        "Fichier prêt pour un dépôt manuel sur le portail de votre plateforme agréée. Aucun accusé n'est produit par ReLink.",
      receipt: null,
      ...(args.facturxPath ? {} : {}),
    };
  },
  async submitTransactionReport() {
    return notConnected("dépôt manuel");
  },
  async submitPaymentReport() {
    return notConnected("dépôt manuel");
  },
  async getInvoiceStatus() {
    return { status: "queued", errorMessage: "Statut à renseigner manuellement après dépôt." };
  },
  async getSubmissionReceipt() {
    return null;
  },
  async cancelPendingSubmission() {
    return { cancelled: true, message: "Dépôt manuel annulé avant transmission." };
  },
  async fetchInboundInvoices() {
    return [];
  },
};

/**
 * Connecteur de test (bac à sable local). Il permet de dérouler tout le
 * parcours technique sans plateforme réelle. Les accusés produits sont
 * explicitement marqués « simulation » et ne valent jamais preuve.
 */
export const sandboxProvider: EInvoicingProvider = {
  key: "relink_sandbox",
  label: "Bac à sable ReLink (simulation)",
  description:
    "Environnement de test interne : aucune donnée n'est transmise à une plateforme agréée ni à l'administration. À utiliser uniquement pour vérifier votre paramétrage.",
  automatic: true,
  simulation: true,
  supportsSandbox: true,
  supportsReception: true,
  supportsTransactionReporting: true,
  supportsPaymentReporting: true,
  async connect() {
    return { status: "connected", message: "Bac à sable connecté (simulation)." };
  },
  async disconnect() {},
  async testConnection(ctx) {
    if (ctx.environment === "production")
      return { ok: false, message: "Le bac à sable ne peut pas être utilisé en production." };
    return { ok: true, message: "Bac à sable joignable — les échanges sont simulés." };
  },
  async resolveRecipient(_ctx, buyer) {
    if (buyer.countryCode !== "FR")
      return { resolved: false, reason: "Le routage B2B domestique ne s'applique pas à un client étranger." };
    if (buyer.einvoicingAddress || buyer.routingId)
      return {
        resolved: true,
        routingId: buyer.routingId ?? buyer.einvoicingAddress ?? null,
        routingScheme: buyer.routingId ? "0225" : "email_directory",
        recipientPlatform: "sandbox-directory",
      };
    if (buyer.siren)
      return {
        resolved: true,
        routingId: buyer.siren,
        routingScheme: "0009",
        recipientPlatform: "sandbox-directory",
      };
    return { resolved: false, reason: "Le SIREN du client professionnel est requis pour résoudre son adresse électronique de facturation." };
  },
  async submitInvoice(ctx, args) {
    const externalId = `SBX-${args.idempotencyKey.slice(0, 24)}`;
    return {
      status: "submitted",
      externalId,
      receipt: {
        content: JSON.stringify(
          {
            simulation: true,
            environment: ctx.environment,
            external_id: externalId,
            invoice_number: args.invoiceNumber,
            routing_id: args.routingId ?? null,
            received_at: new Date().toISOString(),
            note: "Accusé simulé — sans valeur réglementaire.",
          },
          null,
          2,
        ),
        contentType: "application/json",
        externalEventId: externalId,
      },
    };
  },
  async submitTransactionReport(ctx, payload) {
    return {
      status: "submitted",
      externalId: `SBX-ER-${payload.periodStart}-${payload.periodEnd}`,
      receipt: {
        content: JSON.stringify({ simulation: true, environment: ctx.environment, ...payload }, null, 2),
        contentType: "application/json",
      },
    };
  },
  async submitPaymentReport(ctx, payload) {
    return this.submitTransactionReport(ctx, payload);
  },
  async getInvoiceStatus(_ctx, externalId) {
    return { status: "acknowledged", externalId };
  },
  async getSubmissionReceipt(_ctx, externalId) {
    return {
      content: JSON.stringify({ simulation: true, external_id: externalId }, null, 2),
      contentType: "application/json",
      externalEventId: externalId,
    };
  },
  async cancelPendingSubmission() {
    return { cancelled: true, message: "Transmission simulée annulée." };
  },
  async fetchInboundInvoices() {
    return [];
  },
};

export const PROVIDERS: EInvoicingProvider[] = [manualDepositProvider, sandboxProvider];

export function getProvider(key?: string | null): EInvoicingProvider {
  return PROVIDERS.find((p) => p.key === key) ?? manualDepositProvider;
}

/**
 * Clé d'idempotence : un même couple facture + numéro + version + fournisseur
 * ne peut donner qu'une seule transmission, quel que soit le nombre de clics.
 */
export function buildIdempotencyKey(args: {
  invoiceId: string;
  invoiceNumber: string | null;
  version: number | string;
  providerKey: string;
  environment: string;
}) {
  return [args.invoiceId, args.invoiceNumber ?? "sans-numero", String(args.version), args.providerKey, args.environment].join(
    "|",
  );
}
