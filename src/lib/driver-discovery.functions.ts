import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Découverte des chauffeurs : mode « Mon département » (les chauffeurs qui
 * interviennent réellement dans le département du client, quelle que soit leur
 * commune) ou « Tout afficher » (réseau ReLink complet). Le filtrage
 * géographique est réalisé côté serveur, jamais par un masquage d'interface.
 */
export const discoverDrivers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { scope: "department" | "all"; department?: string | null }) =>
      z
        .object({
          scope: z.enum(["department", "all"]),
          department: z
            .string()
            .trim()
            .regex(/^(2A|2B|\d{2,3})$/i)
            .nullish(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { geocodePlaces, driverAreas, driverDepartments } = await import(
      "@/lib/driver-discovery.server"
    );

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
        service_departments: string[] | null;
        quality_score: number | null;
      }
    >;

    const department = data.department ? data.department.toUpperCase() : null;

    if (data.scope === "all" || !department) {
      return {
        scope: "all" as const,
        department,
        drivers: drivers.map((d) => ({ ...d, departments: driverDepartments(d) })),
      };
    }

    // Les chauffeurs sans départements déclarés sont rattachés via leurs zones.
    const needsGeocoding = drivers.filter((d) => !driverDepartments(d).length);
    const places = needsGeocoding.length
      ? await geocodePlaces(
          (await import("@/integrations/supabase/client.server")).supabaseAdmin,
          needsGeocoding.flatMap((d) => driverAreas(d)),
        )
      : undefined;

    const local = drivers
      .map((d) => ({ ...d, departments: driverDepartments(d, places) }))
      .filter((d) => d.departments.includes(department))
      // Classement purement qualitatif : aucune priorité à la commune du client.
      .sort((a, b) => (b.quality_score ?? 0) - (a.quality_score ?? 0));

    return { scope: "department" as const, department, drivers: local };
  });
