/**
 * Référentiels de la vitrine chauffeur ReLink.
 * Utilisés par l'annuaire public, le profil public et l'espace chauffeur.
 */

export const SERVICES = [
  { value: "airport", label: "Transferts aéroport" },
  { value: "station", label: "Transferts gare" },
  { value: "business", label: "Business" },
  { value: "long_distance", label: "Longue distance" },
  { value: "events", label: "Événements" },
  { value: "wedding", label: "Mariage" },
  { value: "disposal", label: "Mise à disposition" },
  { value: "tourism", label: "Transport touristique" },
  { value: "group", label: "Van / groupes" },
  { value: "medical", label: "Transport conventionné" },
] as const;

export const VEHICLE_CATEGORIES = [
  { value: "berline", label: "Berline" },
  { value: "van", label: "Van" },
  { value: "green", label: "Électrique / hybride" },
  { value: "first", label: "Première classe" },
  { value: "break", label: "Break" },
] as const;

export const LANGUAGES = [
  "Français",
  "Anglais",
  "Espagnol",
  "Italien",
  "Allemand",
  "Portugais",
  "Arabe",
  "Russe",
  "Chinois",
] as const;

const SERVICE_MAP = new Map<string, string>(SERVICES.map((s) => [s.value, s.label]));
const CATEGORY_MAP = new Map<string, string>(VEHICLE_CATEGORIES.map((c) => [c.value, c.label]));

/** Libellé lisible d'une prestation (accepte aussi les valeurs libres historiques). */
export function serviceLabel(value: string) {
  return SERVICE_MAP.get(value) ?? value;
}

/** Libellé lisible d'une catégorie de véhicule. */
export function categoryLabel(value: string | null | undefined) {
  if (!value) return null;
  return CATEGORY_MAP.get(value) ?? value;
}
