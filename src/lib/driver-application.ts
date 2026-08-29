/** Éléments strictement obligatoires pour envoyer une demande d'inscription chauffeur. */
export const APPLICATION_DOCS = [
  { docType: "driving_license", label: "Permis de conduire — recto" },
  { docType: "driving_license_back", label: "Permis de conduire — verso" },
  { docType: "identity", label: "Pièce d'identité — recto" },
  { docType: "identity_back", label: "Pièce d'identité — verso" },
  { docType: "insurance", label: "Assurance professionnelle" },
] as const;

export const APPLICATION_DOC_TYPES = APPLICATION_DOCS.map((d) => d.docType) as string[];

export const APPLICATION_DOC_LABELS: Record<string, string> = Object.fromEntries(
  APPLICATION_DOCS.map((d) => [d.docType, d.label]),
);

export type DriverKind = "vtc" | "taxi";

export const DRIVER_KIND_LABELS: Record<string, string> = {
  vtc: "VTC",
  taxi: "Taxi",
};

/** Motifs pré-rédigés proposés à l'administrateur lors d'un refus de pièce. */
export const REJECT_REASONS = [
  "Document illisible",
  "Document expiré",
  "Informations non concordantes",
  "Autre",
];

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  incomplete: "Incomplet",
  pending: "En attente",
  under_review: "En cours de vérification",
  changes_requested: "À corriger",
  verified: "Validé",
  rejected: "Refusé",
  suspended: "Suspendu",
  expired_documents: "Document expiré",
};

export function driverNumber(driver: {
  driver_kind?: string | null;
  vtc_card_number?: string | null;
  taxi_license_number?: string | null;
}) {
  return (
    (driver.driver_kind === "taxi" ? driver.taxi_license_number : driver.vtc_card_number) ?? null
  );
}
