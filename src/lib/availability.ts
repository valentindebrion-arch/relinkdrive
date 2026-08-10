/**
 * Configuration unique de la vérification de faisabilité des créneaux Relink.
 * Ne pas dupliquer ces valeurs dans les composants.
 */
export const SAFETY_MARGIN_MIN = 15;
/** Pas d'arrondi des créneaux proposés (minutes). */
export const SLOT_STEP_MIN = 5;
/** Durée réservée par défaut pour une indisponibilité déclarée au planning. */
export const BLOCK_DURATION_MIN = 60;

export type AvailabilityStatus = "available" | "later" | "unavailable" | "unknown";

export type AvailabilityResult = {
  driverId: string;
  status: AvailabilityStatus;
  /** Premier créneau réellement réalisable (ISO), si calculable. */
  earliestIso: string | null;
  /** Temps de repositionnement estimé depuis la course précédente (minutes). */
  repositionMin: number | null;
  /** Durée estimée de la nouvelle course (minutes). */
  tripMin: number | null;
  marginMin: number;
  /** Motif interne (journalisation / diagnostic), sans données confidentielles. */
  reason: string;
};

export function roundUpToSlot(date: Date, stepMin = SLOT_STEP_MIN) {
  const ms = stepMin * 60_000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

export function formatSlot(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function availabilityMessage(result: AvailabilityResult) {
  switch (result.status) {
    case "available":
      return "Chauffeur disponible à l'heure demandée";
    case "later":
      return result.earliestIso
        ? `Ce chauffeur ne pourra pas arriver à l'heure demandée. Disponible à partir de ${formatSlot(result.earliestIso)}`
        : "Ce chauffeur ne pourra pas arriver à l'heure demandée.";
    case "unavailable":
      return "Ce chauffeur n'est pas disponible à la date ou à l'horaire sélectionné.";

    default:
      return "Vérification impossible pour le moment. Réessayez ou choisissez un autre chauffeur.";
  }
}
