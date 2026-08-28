/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Découverte géographique des chauffeurs, centrée sur le DÉPARTEMENT.
 *
 * Le secteur de référence est le département du client (déduit de sa position
 * ou de la ville choisie). Un chauffeur est éligible dès lors qu'il déclare
 * intervenir dans ce département : la distance exacte à la commune du client
 * n'entre jamais en compte.
 *
 * Les départements d'intervention déclarés (`service_departments`) priment.
 * À défaut, on les déduit des zones d'intervention textuelles via la Base
 * Adresse Nationale, avec un cache en base (`geo_place_cache`).
 */
import { searchAddresses } from "@/lib/geo/provider.server";
import { departmentFromPostcode, departmentFromText } from "@/lib/departments";

export function normalizePlace(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type CachedPlace = { lat: number; lng: number; postcode: string | null };

/** Géocode une liste de libellés de lieux, avec cache partagé en base. */
export async function geocodePlaces(
  admin: any,
  labels: string[],
): Promise<Map<string, CachedPlace>> {
  const wanted = new Map<string, string>();
  for (const raw of labels) {
    const norm = normalizePlace(raw ?? "");
    if (norm.length >= 3 && !wanted.has(norm)) wanted.set(norm, raw);
  }
  const points = new Map<string, CachedPlace>();
  if (!wanted.size) return points;

  const keys = [...wanted.keys()];
  const { data: cached } = await admin
    .from("geo_place_cache")
    .select("name_norm, lat, lng, postcode, resolved")
    .in("name_norm", keys);

  const known = new Set<string>();
  for (const row of cached ?? []) {
    known.add(row.name_norm);
    if (row.resolved && typeof row.lat === "number" && typeof row.lng === "number") {
      points.set(row.name_norm, { lat: row.lat, lng: row.lng, postcode: row.postcode ?? null });
    }
  }

  const missing = keys.filter((k) => !known.has(k));
  const inserts: {
    name_norm: string;
    label: string;
    lat: number | null;
    lng: number | null;
    postcode: string | null;
    resolved: boolean;
  }[] = [];

  for (const key of missing.slice(0, 40)) {
    const label = wanted.get(key)!;
    try {
      const [first] = await searchAddresses(label, 1);
      if (first) {
        points.set(key, { lat: first.lat, lng: first.lng, postcode: first.postcode || null });
        inserts.push({
          name_norm: key,
          label,
          lat: first.lat,
          lng: first.lng,
          postcode: first.postcode || null,
          resolved: true,
        });
      } else {
        inserts.push({ name_norm: key, label, lat: null, lng: null, postcode: null, resolved: false });
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

export type DriverGeo = {
  city: string | null;
  zone: string | null;
  service_areas: string[] | null;
  service_departments: string[] | null;
};

/** Libellés géographiques déclarés par un chauffeur (zones puis ville). */
export function driverAreas(driver: DriverGeo): string[] {
  const declared = [...(driver.service_areas ?? []), driver.zone]
    .filter((v): v is string => !!v && v.trim().length >= 3)
    .map((v) => v.trim());
  if (declared.length) return declared;
  return driver.city && driver.city.trim().length >= 3 ? [driver.city.trim()] : [];
}

/**
 * Départements d'intervention d'un chauffeur :
 *  1. la liste explicitement déclarée ;
 *  2. sinon les codes lisibles dans ses zones (« 63 », « 63170 Aubière ») ;
 *  3. sinon le département des communes géocodées.
 */
export function driverDepartments(
  driver: DriverGeo,
  places?: Map<string, CachedPlace>,
): string[] {
  const codes = new Set<string>();
  for (const raw of driver.service_departments ?? []) {
    const code = departmentFromText(raw);
    if (code) codes.add(code);
  }
  if (codes.size) return [...codes];

  const labels = [...(driver.service_areas ?? []), driver.zone, driver.city].filter(
    (v): v is string => !!v && v.trim().length >= 2,
  );
  for (const label of labels) {
    const code = departmentFromText(label);
    if (code) codes.add(code);
  }
  if (places) {
    for (const label of labels) {
      const p = places.get(normalizePlace(label));
      const code = departmentFromPostcode(p?.postcode ?? null);
      if (code) codes.add(code);
    }
  }
  return [...codes];
}
