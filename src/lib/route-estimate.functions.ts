import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Tarification Relink : 1,90 €/km, minimum 9 €, arrondi à l'euro supérieur (pourboire chauffeur). */
export function priceForKm(km: number) {
  const base = Math.max(9, km * 1.9);
  const total = Math.ceil(base);
  return { base: Math.round(base * 100) / 100, total, tip: Math.round((total - base) * 100) / 100 };
}

export const estimateRoute = createServerFn({ method: "POST" })
  .inputValidator((input: { origin: string; destination: string }) =>
    z
      .object({
        origin: z.string().trim().min(3).max(200),
        destination: z.string().trim().min(3).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { calculateRoute } = await import("@/lib/geo/provider.server");
    const route = await calculateRoute({ address: data.origin }, { address: data.destination });
    if (!route) throw new Error("Itinéraire introuvable pour ces adresses");
    return {
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      origin: route.origin,
      destination: route.destination,
      price: priceForKm(route.distanceKm),
    };
  });

export const suggestAddresses = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string }) =>
    z.object({ query: z.string().trim().min(3).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { searchAddresses } = await import("@/lib/geo/provider.server");
    const results = await searchAddresses(data.query, 6);
    return {
      items: results.slice(0, 6).map((a) => ({
        full: a.label,
        main: a.street || a.label,
        secondary: [a.postcode, a.city].filter(Boolean).join(" "),
        lat: a.lat,
        lng: a.lng,
        id: a.id,
        source: a.source,
      })),
    };
  });

export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((input: { lat: number; lng: number }) =>
    z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { reverseGeocodePoint } = await import("@/lib/geo/provider.server");
    const address = await reverseGeocodePoint({ lat: data.lat, lng: data.lng });
    if (!address) throw new Error("Adresse introuvable à votre position");
    return { address: address.label, lat: address.lat, lng: address.lng };
  });
