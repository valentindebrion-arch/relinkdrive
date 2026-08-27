/**
 * Relais léger entre la fiche publique chauffeur et la page « Mes chauffeurs ».
 * Permet d'enchaîner l'animation d'ajout (achievement) sans casser la navigation.
 */
const KEY = "relink:driver-added";

export type DriverCelebration = {
  driverId: string;
  firstName: string;
  first: boolean;
  at: number;
};

export function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function setDriverCelebration(c: Omit<DriverCelebration, "at">) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...c, at: Date.now() }));
  } catch {
    /* stockage indisponible */
  }
}

/** Lit puis efface la célébration en attente (valide 30 s). */
export function takeDriverCelebration(): DriverCelebration | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as DriverCelebration;
    if (!parsed?.driverId || Date.now() - parsed.at > 30_000) return null;
    return parsed;
  } catch {
    return null;
  }
}
