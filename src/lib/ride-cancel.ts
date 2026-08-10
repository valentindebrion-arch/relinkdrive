/** Fenêtre d'annulation autonome du chauffeur (minutes avant l'heure prévue). */
export const DRIVER_CANCEL_WINDOW_MIN = 30;

/** Statuts pour lesquels une course est encore « à venir » (non démarrée). */
export const PRE_START_STATUSES = ["confirmed", "driver_enroute", "driver_arrived"] as const;

export const DRIVER_CANCEL_REASONS = [
  { value: "breakdown", label: "Panne du véhicule" },
  { value: "accident", label: "Incident ou accident" },
  { value: "unavailable", label: "Indisponibilité exceptionnelle" },
  { value: "other", label: "Autre contrainte" },
] as const;

export function driverCancelDeadline(scheduledIso: string) {
  return new Date(new Date(scheduledIso).getTime() - DRIVER_CANCEL_WINDOW_MIN * 60_000);
}

export function driverCancelReasonLabel(value?: string | null) {
  if (!value) return null;
  return DRIVER_CANCEL_REASONS.find((r) => r.value === value)?.label ?? value;
}
