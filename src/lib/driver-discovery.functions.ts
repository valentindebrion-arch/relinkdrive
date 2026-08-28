import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Découverte des chauffeurs : mode « autour de moi » (rayon réel en kilomètres)
 * ou « tout afficher » (réseau ReLink complet). Le filtrage géographique est
 * réalisé côté serveur, jamais par un simple masquage d'interface.
 */
export const discoverDrivers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      scope: "nearby" | "all";
      sector?: string | null;
      lat?: number | null;
      lng?: number | null;
      radiusKm?: number;
    }) =>
      z
        .object({
          scope: z.enum(["nearby", "all"]),
          sector: z.string().trim().max(120).nullish(),
          lat: z.number().min(-90).max(90).nullish(),
          lng: z.number().min(-180).max(180).nullish(),
          radiusKm: z.number().min(5).max(300).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { geocodePlaces, driverAreas, haversineKm, normalizePlace, NEARBY_RADIUS_KM } =
      await import("@/lib/driver-discovery.server");
    const radiusKm = data.radiusKm ?? NEARBY_RADIUS_KM;

    const { data: rows, error } = await context.supabase.rpc("get_local_drivers", {
      _limit: 100,
    });
    if (error) throw new Error(error.message);
    const drivers = (rows ?? []) as unknown as Array<
      Record<string, unknown> & {
        user_id: string;
        city: string | null;
        zone: string | null;
        service_areas: string[] | null;
        quality_score: number | null;
      }
    >;

    if (data.scope === "all") {
      return {
        scope: "all" as const,
        radiusKm,
        origin: null as string | null,
        drivers: drivers.map((d) => ({ ...d, distance_km: null as number | null })),
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Point de référence du client : coordonnées du navigateur, sinon sa ville.
    let point: { lat: number; lng: number } | null =
      typeof data.lat === "number" && typeof data.lng === "number"
        ? { lat: data.lat, lng: data.lng }
        : null;
    if (!point && data.sector) {
      const resolved = await geocodePlaces(supabaseAdmin, [data.sector]);
      point = resolved.get(normalizePlace(data.sector)) ?? null;
    }

    if (!point) {
      // Aucun repère géographique : on n'invente pas de rayon, on montre tout.
      return {
        scope: "all" as const,
        radiusKm,
        origin: data.sector ?? null,
        drivers: drivers.map((d) => ({ ...d, distance_km: null as number | null })),
      };
    }

    const labels = drivers.flatMap((d) => driverAreas(d));
    const places = await geocodePlaces(supabaseAdmin, labels);

    const nearby = drivers
      .map((d) => {
        let best: number | null = null;
        for (const area of driverAreas(d)) {
          const p = places.get(normalizePlace(area));
          if (!p) continue;
          const km = haversineKm(point, p);
          if (best === null || km < best) best = km;
        }
        return { ...d, distance_km: best };
      })
      .filter((d) => d.distance_km !== null && d.distance_km <= radiusKm)
      .sort((a, b) => {
        // Proximité d'abord (par paliers de 10 km), puis qualité du profil.
        const bucket = (km: number) => Math.floor(km / 10);
        const diff = bucket(a.distance_km!) - bucket(b.distance_km!);
        if (diff !== 0) return diff;
        return (b.quality_score ?? 0) - (a.quality_score ?? 0);
      });

    return {
      scope: "nearby" as const,
      radiusKm,
      origin: data.sector ?? null,
      drivers: nearby,
    };
  });
