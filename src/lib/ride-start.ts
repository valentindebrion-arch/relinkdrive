/** Fenêtre d'activation du bouton « Démarrer la course » (minutes avant l'heure prévue). */
export const START_WINDOW_MIN = 30;

export function startWindowOpensAt(scheduledIso: string) {
  return new Date(new Date(scheduledIso).getTime() - START_WINDOW_MIN * 60_000);
}

export function formatHour(date: Date) {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
