/** Estimation des temps de conduite réels via le service géographique interne. */
import { calculateRoute } from "@/lib/geo/provider.server";

/**
 * Durée de conduite estimée entre deux adresses, en minutes.
 * Renvoie null si le calcul est impossible : l'appelant ne doit alors jamais
 * annoncer une disponibilité.
 */
export async function travelMinutes(
  origin: string,
  destination: string,
  _departure?: Date,
): Promise<number | null> {
  const from = origin.trim();
  const to = destination.trim();
  if (from.length < 3 || to.length < 3) return null;
  if (from.toLowerCase() === to.toLowerCase()) return 0;

  const route = await calculateRoute({ address: from }, { address: to });
  return route ? route.durationMin : null;
}
