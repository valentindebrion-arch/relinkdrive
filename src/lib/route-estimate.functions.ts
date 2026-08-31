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

/**
 * Estimation indicative rattachée à la vitrine d'un chauffeur.
 *
 * Le plancher tarifaire du chauffeur (course minimum) est appliqué côté
 * serveur : le client ne peut jamais recevoir une fourchette dont la borne
 * basse est inférieure au minimum configuré par le chauffeur.
 */
export function applyMinimumFare(low: number, high: number, minimum: number | null) {
  const min = minimum && minimum > 0 ? minimum : 0;
  const finalLow = Math.max(low, min);
  // Marge cohérente avec le moteur (≈ 15 %, arrondie à 5 €) lorsque toute la
  // fourchette brute passe sous le minimum du chauffeur.
  const margin = Math.max(5, Math.ceil((finalLow * 0.15) / 5) * 5);
  const finalHigh = Math.max(high, finalLow + (high <= finalLow ? margin : 0));
  return { low: Math.round(finalLow), high: Math.round(finalHigh) };
}

export const estimateDriverTrip = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string; origin: string; destination: string }) =>
    z
      .object({
        slug: z.string().trim().min(1).max(120),
        origin: z.string().trim().min(3).max(200),
        destination: z.string().trim().min(3).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { calculateRoute } = await import("@/lib/geo/provider.server");
    const route = await calculateRoute({ address: data.origin }, { address: data.destination });
    if (!route) throw new Error("Itinéraire introuvable pour ces adresses");

    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabasePublic = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    let perKm: number | null = null;
    let minimum: number | null = null;
    let pickupPct = 0;
    try {
      const { data: pricing } = await supabasePublic.rpc("get_public_driver_pricing", {
        _slug: data.slug,
      });
      const t = (pricing as { price_per_km?: number; minimum?: number; pickup_pct?: number }[])?.[0];
      if (t?.price_per_km) perKm = Number(t.price_per_km);
      if (t?.minimum != null) minimum = Number(t.minimum);
      pickupPct = Number(t?.pickup_pct ?? 0);
    } catch {
      /* repli sur le tarif de marché */
    }

    const reference =
      perKm != null
        ? Math.max(minimum ?? 0, route.distanceKm * perKm) * (1 + pickupPct / 100)
        : priceForKm(route.distanceKm).total;

    const raw = {
      low: Math.max(5, Math.floor((reference * 0.9) / 5) * 5),
      high: Math.ceil((reference * 1.15) / 5) * 5,
    };
    const range = applyMinimumFare(raw.low, raw.high, minimum);

    return {
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      low: range.low,
      high: range.high,
      minimum,
    };
  });
