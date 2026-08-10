/** Estimation des temps de conduite réels via le service cartographique du projet. */
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function gatewayHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) throw new Error("Service de cartographie indisponible");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
    "Content-Type": "application/json",
    "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
  };
}

/**
 * Durée de conduite estimée entre deux adresses, en minutes.
 * Renvoie null si le calcul est impossible : l'appelant ne doit alors jamais
 * annoncer une disponibilité.
 */
export async function travelMinutes(
  origin: string,
  destination: string,
  departure?: Date,
): Promise<number | null> {
  const from = origin.trim();
  const to = destination.trim();
  if (from.length < 3 || to.length < 3) return null;
  if (from.toLowerCase() === to.toLowerCase()) return 0;

  const trafficAware = departure ? departure.getTime() > Date.now() + 60_000 : false;
  const body: Record<string, unknown> = {
    origin: { address: from },
    destination: { address: to },
    travelMode: "DRIVE",
    routingPreference: trafficAware ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE",
    languageCode: "fr-FR",
    units: "METRIC",
  };
  if (trafficAware && departure) body["departureTime"] = departure.toISOString();

  try {
    const response = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: gatewayHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error(`Availability route failed [${response.status}]: ${await response.text()}`);
      return null;
    }
    const json = (await response.json()) as { routes?: Array<{ duration?: string }> };
    const duration = json.routes?.[0]?.duration;
    if (!duration) return null;
    return Math.round(Number(duration.replace("s", "")) / 60);
  } catch (error) {
    console.error("Availability route error", error);
    return null;
  }
}
