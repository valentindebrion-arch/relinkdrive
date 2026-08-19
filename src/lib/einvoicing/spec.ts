/**
 * Lot 2 — Facturation électronique (France).
 *
 * ReLink est une **solution métier compatible** : le chauffeur (ou son
 * entreprise) reste l'émetteur de la facture, le prestataire du transport et le
 * responsable des données fiscales déclarées. ReLink n'est pas une plateforme
 * agréée et ne se connecte à l'administration qu'au travers d'une plateforme
 * agréée tierce, une fois ses API de production réellement opérationnelles.
 */

export const FACTURX_SPEC_VERSION = "Factur-X 1.07.3";
export const FACTURX_PROFILE = "EN16931" as const;
export const CII_STANDARD = "UN/CEFACT CII D22B — EN 16931";

export type EntityCategory = "unknown" | "micro" | "tpe" | "pme" | "eti" | "ge";

export const ENTITY_CATEGORY_LABELS: Record<EntityCategory, string> = {
  unknown: "Non renseignée",
  micro: "Microentreprise",
  tpe: "TPE",
  pme: "PME",
  eti: "ETI",
  ge: "Grande entreprise",
};

export type EntityCategorySource = "declared" | "document" | "registry";

export const ENTITY_CATEGORY_SOURCE_LABELS: Record<EntityCategorySource, string> = {
  declared: "Déclarée par le chauffeur",
  document: "Justifiée par un document",
  registry: "Confirmée par un registre",
};

/** Réception obligatoire pour toutes les entreprises concernées. */
export const RECEPTION_OBLIGATION_DATE = "2026-09-01";
/** Émission + e-reporting : grandes entreprises et ETI. */
export const ISSUANCE_OBLIGATION_LARGE = "2026-09-01";
/** Émission + e-reporting : PME, TPE et microentreprises. */
export const ISSUANCE_OBLIGATION_SMALL = "2027-09-01";

/**
 * Date d'entrée en obligation d'émission selon la catégorie déclarée.
 * `null` tant que la catégorie n'est pas renseignée : aucune déduction
 * automatique n'est faite à partir de la seule forme juridique.
 */
export function issuanceObligationDate(category: EntityCategory): string | null {
  if (category === "ge" || category === "eti") return ISSUANCE_OBLIGATION_LARGE;
  if (category === "pme" || category === "tpe" || category === "micro") return ISSUANCE_OBLIGATION_SMALL;
  return null;
}

export type ObligationState = {
  receptionDate: string;
  issuanceDate: string | null;
  receptionDue: boolean;
  issuanceDue: boolean;
  anticipation: boolean;
};

export function obligationState(
  category: EntityCategory,
  anticipationOptIn: boolean,
  today = new Date(),
): ObligationState {
  const issuanceDate = issuanceObligationDate(category);
  const d = today.toISOString().slice(0, 10);
  const issuanceDue = !!issuanceDate && d >= issuanceDate;
  return {
    receptionDate: RECEPTION_OBLIGATION_DATE,
    issuanceDate,
    receptionDue: d >= RECEPTION_OBLIGATION_DATE,
    issuanceDue,
    // L'anticipation reste volontaire : elle n'est jamais présentée comme une obligation.
    anticipation: anticipationOptIn && !issuanceDue,
  };
}

export const PA_STATUS_LABELS: Record<string, string> = {
  none: "Aucune plateforme agréée sélectionnée",
  pending: "Raccordement en cours",
  connected: "Raccordement déclaré",
  error: "Raccordement en erreur",
};

export const TRANSMISSION_STATUS_LABELS: Record<string, string> = {
  not_applicable: "Sans objet",
  pending: "En attente d'envoi",
  sent: "Transmise à la plateforme",
  accepted: "Acceptée",
  rejected: "Rejetée",
  failed: "Échec technique",
  not_configured: "Aucune plateforme agréée raccordée",
  acknowledged: "Accusé de réception reçu",
};

export const EREPORTING_KIND_LABELS: Record<string, string> = {
  transaction: "E-reporting de transaction",
  payment: "E-reporting de paiement",
};
