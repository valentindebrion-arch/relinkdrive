export const RIDE_STATUS_LABELS: Record<string, string> = {
  new: "Nouvelle demande",
  reviewing: "À étudier",
  proposal_sent: "Proposition envoyée",
  awaiting_client: "En attente du client",
  confirmed: "Confirmée",
  driver_enroute: "Chauffeur en approche",
  driver_arrived: "Chauffeur arrivé",
  client_onboard: "Client à bord",
  in_progress: "Course en cours",
  completed: "Terminée",
  cancelled: "Annulée",
  refused: "Refusée",
};

export const VERIFICATION_LABELS: Record<string, string> = {
  incomplete: "Profil incomplet",
  pending: "En attente de vérification",
  verified: "Vérifié",
  changes_requested: "Correction demandée",
  rejected: "Refusé",
  suspended: "Suspendu",
};

export const DOCUMENT_LABELS: Record<string, string> = {
  identity: "Pièce d'identité",
  driving_license: "Permis de conduire",
  vtc_card: "Carte professionnelle VTC",
  company_proof: "Justificatif d'entreprise (SIRET)",
  registration: "Carte grise",
  insurance: "Assurance",
  inspection: "Contrôle technique",
  other: "Autre justificatif",
};

export const DOCUMENT_TYPES = Object.keys(DOCUMENT_LABELS);

export const DOC_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Validé",
  rejected: "Refusé",
  expired: "Expiré",
};

export const CRM_LABELS: Record<string, string> = {
  new: "Nouveau",
  active: "Actif",
  regular: "Régulier",
  inactive: "Inactif",
};

export const INVOICE_LABELS: Record<string, string> = {
  draft: "Brouillon à compléter",
  issued: "Émise",
  sent: "Envoyée",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée",
};

export const PAYMENT_METHODS: Record<string, string> = {
  card: "Carte bancaire",
  cash: "Espèces",
  transfer: "Virement",
  invoice: "Sur facture",
  other: "Autre",
};

export const REPORT_LABELS: Record<string, string> = {
  new: "Nouveau",
  in_progress: "En cours",
  waiting: "En attente",
  resolved: "Résolu",
  closed: "Fermé",
};

export const REPORT_TYPES: Record<string, string> = {
  ride_issue: "Problème pendant une course",
  behaviour: "Comportement inapproprié",
  billing: "Erreur de facturation",
  suspicious: "Compte suspect",
  expired_doc: "Document expiré",
  security: "Problème de sécurité",
  privacy: "Demande liée aux données personnelles",
};

export function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (["verified", "completed", "paid", "confirmed", "approved", "resolved"].includes(status))
    return "success";
  if (
    ["pending", "reviewing", "proposal_sent", "awaiting_client", "changes_requested", "waiting", "sent", "in_progress", "new", "issued"].includes(
      status,
    )
  )
    return "warning";
  if (["cancelled", "refused", "rejected", "suspended", "expired", "overdue"].includes(status)) return "danger";
  if (["driver_enroute", "driver_arrived", "client_onboard"].includes(status)) return "info";
  return "neutral";
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { dateStyle: "medium" });
}

export function formatEuro(value?: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
