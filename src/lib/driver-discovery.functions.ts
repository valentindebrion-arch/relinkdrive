import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VEHICLE_MATCH_FIELDS =
  "driver_id, max_passengers, large_luggage_capacity, cabin_luggage_capacity, pets_policy, pets_allowed, child_seat, booster_seat, stroller_space, accessible, large_trunk, category, is_primary, created_at";

async function addVehicleMatchFields<T extends { user_id: string }>(drivers: T[]) {
  if (!drivers.length) return drivers;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ids = drivers.map((driver) => driver.user_id);
  const [{ data: vehicles }, { data: themes }] = await Promise.all([
    supabaseAdmin
      .from("vehicles")
      .select(VEHICLE_MATCH_FIELDS)
      .in("driver_id", ids)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
    supabaseAdmin.from("driver_profiles").select("user_id, booking_theme").in("user_id", ids),
  ]);

  const primaryByDriver = new Map<string, Record<string, unknown>>();
  for (const vehicle of vehicles ?? []) {
    if (!primaryByDriver.has(vehicle.driver_id)) {
      primaryByDriver.set(vehicle.driver_id, {
        max_passengers: vehicle.max_passengers,
        large_luggage_capacity: vehicle.large_luggage_capacity,
        cabin_luggage_capacity: vehicle.cabin_luggage_capacity,
        pets_policy: vehicle.pets_policy,
        pets_allowed: vehicle.pets_allowed,
        child_seat: vehicle.child_seat,
        booster_seat: vehicle.booster_seat,
        stroller_space: vehicle.stroller_space,
        accessible: vehicle.accessible,
        large_trunk: vehicle.large_trunk,
      });
    }
  }
  const themeByDriver = new Map((themes ?? []).map((row) => [row.user_id, row.booking_theme]));
  return drivers.map((driver) => ({
    ...driver,
    ...primaryByDriver.get(driver.user_id),
    booking_theme: themeByDriver.get(driver.user_id) ?? null,
  }));
}

/** Déduit le département du lieu de départ confirmé par le client. */
export const resolveSearchDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin: string }) =>
    z.object({ origin: z.string().trim().min(3).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { searchAddresses } = await import("@/lib/geo/provider.server");
    const { departmentFromPostcode } = await import("@/lib/departments");
    const [place] = await searchAddresses(data.origin, 1);
    return {
      department: departmentFromPostcode(place?.postcode ?? null),
      city: place?.city ?? null,
    };
  });

/**
 * Découverte des chauffeurs : mode « Mon département » (les chauffeurs qui
 * interviennent réellement dans le département du client, quelle que soit leur
 * commune) ou « Tout afficher » (réseau ReLink complet). Le filtrage
 * géographique est réalisé côté serveur, jamais par un masquage d'interface.
 */
export const discoverDrivers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scope: "department" | "all"; department?: string | null }) =>
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
    const { geocodePlaces, driverAreas, driverDepartments } =
      await import("@/lib/driver-discovery.server");

    const { data: rows, error } = await context.supabase.rpc("get_local_drivers", {
      _limit: 200,
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
      const enriched = await addVehicleMatchFields(
        drivers.map((d) => ({ ...d, departments: driverDepartments(d) })),
      );
      return {
        scope: "all" as const,
        department,
        drivers: enriched,
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

    return {
      scope: "department" as const,
      department,
      drivers: await addVehicleMatchFields(local),
    };
  });
