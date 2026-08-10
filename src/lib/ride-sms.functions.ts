import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SMS_STATUSES, normalizePhone } from "@/lib/ride-sms";

type SmsTarget = {
  phone: string | null;
  driverFirstName: string | null;
  scheduledAt: string | null;
  allowed: boolean;
};

/**
 * Numéro du client d'une course, réservé au chauffeur affecté et uniquement
 * pendant la phase « en route / arrivé ». Jamais exposé ailleurs.
 */
export const getRideClientSmsTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rideId: string }) => z.object({ rideId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<SmsTarget> => {
    const { supabase, userId } = context;
    const empty: SmsTarget = { phone: null, driverFirstName: null, scheduledAt: null, allowed: false };

    const { data: ride } = await supabase
      .from("rides")
      .select("id, client_id, driver_id, status, scheduled_at, started_at, completed_at, is_block")
      .eq("id", data.rideId)
      .maybeSingle();
    if (!ride || ride.driver_id !== userId || ride.is_block || !ride.client_id) return empty;
    if (ride.completed_at || ride.status === "cancelled" || ride.status === "completed") return empty;
    if (!(SMS_STATUSES as readonly string[]).includes(ride.status)) return empty;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: client }, { data: driver }] = await Promise.all([
      supabaseAdmin.from("profiles").select("phone").eq("id", ride.client_id).maybeSingle(),
      supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    ]);

    return {
      phone: normalizePhone(client?.phone ?? null),
      driverFirstName: driver?.full_name?.trim().split(/\s+/)[0] ?? null,
      scheduledAt: ride.scheduled_at,
      allowed: true,
    };
  });

/** Trace uniquement l'ouverture de l'action (jamais « SMS envoyé », ni le contenu du message). */
export const logSmsIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rideId: string }) => z.object({ rideId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ride } = await supabase
      .from("rides")
      .select("id, driver_id")
      .eq("id", data.rideId)
      .maybeSingle();
    if (!ride || ride.driver_id !== userId) return { ok: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("analytics_events").insert({
      event: "driver_sms_intent_opened",
      driver_id: userId,
      metadata: { ride_id: ride.id },
    });
    return { ok: true as const };
  });
