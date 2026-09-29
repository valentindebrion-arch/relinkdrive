import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VEHICLE_PHOTO_FIELDS = [
  "photo_url",
  "photo_front_url",
  "photo_side_url",
  "photo_interior_url",
  "photo_trunk_url",
] as const;

/**
 * Remet à zéro uniquement la vitrine publique du chauffeur.
 * Le compte, l'abonnement, les factures, la société, les justificatifs et les
 * décisions administratives ne sont jamais modifiés.
 */
export const resetMyDriverShowcase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ confirmation: z.literal("REINITIALISER") }).parse(input),
  )
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const driverId = context.userId;

    const [{ data: driver }, { data: profile }, { data: vehicles }] = await Promise.all([
      supabaseAdmin
        .from("driver_profiles")
        .select("user_id, brand_logo_path, brand_cover_path")
        .eq("user_id", driverId)
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("avatar_url").eq("id", driverId).maybeSingle(),
      supabaseAdmin
        .from("vehicles")
        .select(
          "id, photo_url, photo_front_url, photo_side_url, photo_interior_url, photo_trunk_url",
        )
        .eq("driver_id", driverId),
    ]);
    if (!driver) throw new Error("Profil chauffeur introuvable.");

    const { error: driverError } = await supabaseAdmin
      .from("driver_profiles")
      .update({
        public_intro: null,
        bio: null,
        city: null,
        zone: null,
        service_areas: [],
        service_departments: [],
        stations: [],
        airports: [],
        long_distance: false,
        availability: [],
        booking_notice: null,
        services: [],
        languages: [],
        working_hours: {},
        public_phone: null,
        show_public_phone: false,
        whatsapp_number: null,
        show_whatsapp: false,
        website_url: null,
        instagram_url: null,
        facebook_url: null,
        tiktok_url: null,
        linkedin_url: null,
        payment_methods: [],
        experience_years: null,
        booking_theme: "relink_classic",
        brand_display_name: null,
        brand_welcome_message: null,
        brand_logo_path: null,
        brand_cover_path: null,
        woman_for_woman: false,
        accepting_requests: false,
        on_duty: false,
      })
      .eq("user_id", driverId);
    if (driverError) throw new Error(driverError.message);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", driverId);
    if (profileError) throw new Error(profileError.message);

    const [{ error: vehicleError }, { error: tariffError }] = await Promise.all([
      supabaseAdmin.from("vehicles").delete().eq("driver_id", driverId),
      supabaseAdmin.from("driver_tariffs").delete().eq("driver_id", driverId),
    ]);
    if (vehicleError) throw new Error(vehicleError.message);
    if (tariffError) throw new Error(tariffError.message);

    const vehiclePaths = (vehicles ?? []).flatMap((vehicle) =>
      VEHICLE_PHOTO_FIELDS.map((field) => vehicle[field]).filter(
        (path): path is string => typeof path === "string" && !!path,
      ),
    );
    const avatarPath = profile?.avatar_url;
    const brandingPaths = [driver.brand_logo_path, driver.brand_cover_path].filter(
      (path): path is string => typeof path === "string" && !!path,
    );
    await Promise.all([
      vehiclePaths.length
        ? supabaseAdmin.storage.from("vehicles").remove(vehiclePaths)
        : Promise.resolve(),
      avatarPath && !/^https?:\/\//.test(avatarPath)
        ? supabaseAdmin.storage.from("avatars").remove([avatarPath])
        : Promise.resolve(),
      brandingPaths.length
        ? supabaseAdmin.storage.from("branding").remove(brandingPaths)
        : Promise.resolve(),
    ]);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: driverId,
      action: "driver_showcase_reset",
      resource: "driver_profiles",
      resource_id: driverId,
      reason: "Réinitialisation volontaire de la vitrine depuis l'espace chauffeur",
    });

    return { ok: true as const };
  });
