/**
 * Couche de service géographique interne.
 *
 * Fournisseurs actuels (services publics français, sans clé d'API) :
 *  - Adresses : API Adresse (Base Adresse Nationale) — api-adresse.data.gouv.fr
 *  - Itinéraires routiers : IGN Géoplateforme — data.geopf.fr/navigation
 *
 * Le reste de l'application ne dépend jamais du format brut d'un fournisseur :
 * elle consomme uniquement les types de `@/lib/geo/types`.
 */
import type { GeoAddress, GeoPoint, GeoRoute, RoutePlace } from "@/lib/geo/types";

const BAN_URL = "https://api-adresse.data.gouv.fr";
const IGN_ROUTE_URL = "https://data.geopf.fr/navigation/itineraire";
const ADDRESS_SOURCE = "ban";
const ROUTE_PROVIDER = "ign-geoplateforme";

type BanFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    label?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    postcode?: string;
    city?: string;
    id?: string;
  };
};

function normalize(feature: BanFeature): GeoAddress | null {
  const coords = feature.geometry?.coordinates;
  const p = feature.properties;
  if (!coords || !p?.label) return null;
  const [lng, lat] = coords;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    label: p.label,
    street: p.name ?? [p.housenumber, p.street].filter(Boolean).join(" ").trim(),
    postcode: p.postcode ?? "",
    city: p.city ?? "",
    country: "France",
    lat,
    lng,
    id: p.id ?? null,
    source: ADDRESS_SOURCE,
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Geo provider failed [${response.status}] ${url}: ${body.slice(0, 300)}`);
    throw new Error("Service d'adresses momentanément indisponible");
  }
  return response.json();
}

/** Recherche d'adresses, priorisée sur la France. */
export async function searchAddresses(query: string, limit = 6): Promise<GeoAddress[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const json = (await fetchJson(
    `${BAN_URL}/search/?q=${encodeURIComponent(q)}&limit=${limit}&autocomplete=1`,
  )) as { features?: BanFeature[] };
  return (json.features ?? []).map(normalize).filter((a): a is GeoAddress => !!a);
}

/** Géocodage inverse : coordonnées → adresse lisible. */
export async function reverseGeocodePoint(point: GeoPoint): Promise<GeoAddress | null> {
  const json = (await fetchJson(`${BAN_URL}/reverse/?lon=${point.lng}&lat=${point.lat}`)) as {
    features?: BanFeature[];
  };
  const first = (json.features ?? []).map(normalize).find((a): a is GeoAddress => !!a);
  return first ?? null;
}

/** Résout une entrée en coordonnées (géocodage si seule l'adresse est connue). */
export async function resolvePlace(place: RoutePlace): Promise<GeoPoint | null> {
  if (typeof place.lat === "number" && typeof place.lng === "number") {
    return { lat: place.lat, lng: place.lng };
  }
  if (!place.address) return null;
  const [first] = await searchAddresses(place.address, 1);
  return first ? { lat: first.lat, lng: first.lng } : null;
}

function coord(p: GeoPoint) {
  return `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;
}

/**
 * Itinéraire routier réel (jamais une distance à vol d'oiseau).
 * Renvoie `null` si le calcul est impossible : l'appelant ne doit alors
 * afficher ni distance ni tarif.
 */
export async function calculateRoute(
  origin: RoutePlace,
  destination: RoutePlace,
  waypoints: RoutePlace[] = [],
): Promise<GeoRoute | null> {
  try {
    const [from, to] = await Promise.all([resolvePlace(origin), resolvePlace(destination)]);
    if (!from || !to) return null;
    const vias: GeoPoint[] = [];
    for (const w of waypoints) {
      const p = await resolvePlace(w);
      if (p) vias.push(p);
    }
    const params = new URLSearchParams({
      resource: "bdtopo-osrm",
      profile: "car",
      optimization: "fastest",
      start: coord(from),
      end: coord(to),
      getSteps: "false",
      geometryFormat: "geojson",
      distanceUnit: "kilometer",
      timeUnit: "minute",
    });
    if (vias.length) params.set("intermediates", vias.map(coord).join("|"));
    const response = await fetch(`${IGN_ROUTE_URL}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      console.error(`Route provider failed [${response.status}]: ${await response.text()}`);
      return null;
    }
    const json = (await response.json()) as { distance?: number; duration?: number };
    if (typeof json.distance !== "number" || typeof json.duration !== "number") return null;
    return {
      distanceKm: Math.round(json.distance * 10) / 10,
      durationMin: Math.max(1, Math.round(json.duration)),
      origin: from,
      destination: to,
      waypoints: vias,
      status: "ok",
      provider: ROUTE_PROVIDER,
    };
  } catch (error) {
    console.error("Route provider error", error);
    return null;
  }
}
