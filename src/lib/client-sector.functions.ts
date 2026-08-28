import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Secteur du client déduit de sa position : commune, code postal et surtout
 * code département — c'est ce dernier qui pilote la découverte des chauffeurs.
 */
export const resolveSector = createServerFn({ method: "POST" })
  .inputValidator((input: { lat: number; lng: number }) =>
    z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { reverseGeocodePoint } = await import("@/lib/geo/provider.server");
    const { departmentFromPostcode } = await import("@/lib/departments");
    const address = await reverseGeocodePoint({ lat: data.lat, lng: data.lng });
    if (!address?.city) throw new Error("Secteur introuvable à votre position");
    return {
      city: address.city,
      postcode: address.postcode,
      department: departmentFromPostcode(address.postcode),
      lat: address.lat,
      lng: address.lng,
    };
  });

/** Suggestions de secteurs (villes françaises) pour la sélection manuelle. */
export const searchSectors = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string }) =>
    z.object({ query: z.string().trim().min(2).max(80) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { searchAddresses } = await import("@/lib/geo/provider.server");
    const { departmentFromPostcode } = await import("@/lib/departments");
    const results = await searchAddresses(data.query, 8);
    const seen = new Set<string>();
    const cities: {
      city: string;
      postcode: string;
      department: string | null;
      lat: number;
      lng: number;
    }[] = [];
    for (const a of results) {
      const key = a.city.toLowerCase();
      if (!a.city || seen.has(key)) continue;
      seen.add(key);
      cities.push({
        city: a.city,
        postcode: a.postcode,
        department: departmentFromPostcode(a.postcode),
        lat: a.lat,
        lng: a.lng,
      });
    }
    return { items: cities.slice(0, 6) };
  });
