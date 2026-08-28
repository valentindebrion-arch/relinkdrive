/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Découverte géographique des chauffeurs.
 *
 * Les zones d'intervention sont déclarées sous forme de libellés (villes).
 * On les convertit en coordonnées via la Base Adresse Nationale, avec un cache
 * en base (`geo_place_cache`) pour éviter de re-géocoder à chaque visite.
 * La distance est ensuite calculée par formule de Haversine : aucune liste de
 * communes n'est codée en dur.
 */
import { searchAddresses } from "@/lib/geo/provider.server";
import type { GeoPoint } from "@/lib/geo/types";

export const NEARBY_RADIUS_KM = 50;

export function normalizePlace(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function haversineKm(a: GeoPoint, b: GeoPoint) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** Géocode une liste de libellés de lieux, avec cache partagé en base. */
export async function geocodePlaces(
  admin: any,
  labels: string[],
): Promise<Map<string, GeoPoint>> {
  const wanted = new Map<string, string>();
  for (const raw of labels) {
    const norm = normalizePlace(raw ?? "");
    if (norm.length >= 3 && !wanted.has(norm)) wanted.set(norm, raw);
  }
  const points = new Map<string, GeoPoint>();
  if (!wanted.size) return points;

  const keys = [...wanted.keys()];
  const { data: cached } = await admin
    .from("geo_place_cache")
    .select("name_norm, lat, lng, resolved")
    .in("name_norm", keys);

  const known = new Set<string>();
  for (const row of cached ?? []) {
    known.add(row.name_norm);
    if (row.resolved && typeof row.lat === "number" && typeof row.lng === "number") {
      points.set(row.name_norm, { lat: row.lat, lng: row.lng });
    }
  }

  const missing = keys.filter((k) => !known.has(k));
  const inserts: {
    name_norm: string;
    label: string;
    lat: number | null;
    lng: number | null;
    resolved: boolean;
  }[] = [];

  for (const key of missing.slice(0, 40)) {
    const label = wanted.get(key)!;
    try {
      const [first] = await searchAddresses(label, 1);
      if (first) {
        points.set(key, { lat: first.lat, lng: first.lng });
        inserts.push({
          name_norm: key,
          label,
          lat: first.lat,
          lng: first.lng,
          resolved: true,
        });
      } else {
        inserts.push({ name_norm: key, label, lat: null, lng: null, resolved: false });
      }
    } catch {
      /* service momentanément indisponible : on réessaiera plus tard */
    }
  }

  if (inserts.length) {
    await admin.from("geo_place_cache").upsert(inserts, { onConflict: "name_norm" });
  }
  return points;
}

/**
 * Zones géographiques d'un chauffeur : les zones d'intervention déclarées
 * priment ; la ville d'adresse n'est utilisée qu'en dernier recours.
 */
export function driverAreas(driver: {
  city: string | null;
  zone: string | null;
  service_areas: string[] | null;
}): string[] {
  const declared = [...(driver.service_areas ?? []), driver.zone]
    .filter((v): v is string => !!v && v.trim().length >= 3)
    .map((v) => v.trim());
  if (declared.length) return declared;
  return driver.city && driver.city.trim().length >= 3 ? [driver.city.trim()] : [];
}
