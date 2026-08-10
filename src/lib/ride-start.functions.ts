import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { START_WINDOW_MIN } from "@/lib/ride-start";

/** Statuts depuis lesquels un démarrage manuel est autorisé. */
const STARTABLE = ["confirmed", "driver_enroute", "driver_arrived", "client_onboard"] as const;
/** Une course déjà démarrée et non terminée. */
const RUNNING = ["in_progress"] as const;

/** Heure serveur de référence : ne jamais se fier à l'horloge du téléphone. */
export const getServerNow = createServerFn({ method: "GET" }).handler(async () => ({
  nowIso: new Date().toISOString(),
}));

export const startRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rideId: string }) =>
    z.object({ rideId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ride, error } = await supabase
      .from("rides")
      .select("id, driver_id, status, scheduled_at, started_at, is_block")
      .eq("id", data.rideId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ride || ride.driver_id !== userId || ride.is_block) {
      throw new Error("Course introuvable");
    }
    if (ride.status === "in_progress" || ride.started_at) {
      throw new Error("Cette course est déjà démarrée");
    }
    if (!(STARTABLE as readonly string[]).includes(ride.status)) {
      throw new Error("Cette course ne peut pas être démarrée");
    }

    const now = new Date();
    const scheduled = new Date(ride.scheduled_at);
    if (now.getTime() < scheduled.getTime() - START_WINDOW_MIN * 60_000) {
      throw new Error("Le démarrage n'est pas encore autorisé pour ce créneau");
    }

    const { count } = await supabase
      .from("rides")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", userId)
      .eq("is_block", false)
      .in("status", [...RUNNING])
      .neq("id", ride.id);
    if ((count ?? 0) > 0) throw new Error("Une autre course est déjà en cours");

    // Mise à jour conditionnelle : un second appui ne peut pas démarrer deux fois.
    const { data: updated, error: updateError } = await supabase
      .from("rides")
      .update({ status: "in_progress" as never, started_at: now.toISOString() })
      .eq("id", ride.id)
      .eq("driver_id", userId)
      .is("started_at", null)
      .neq("status", "in_progress")
      .select("id, started_at")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updated) throw new Error("Cette course est déjà démarrée");

    await supabase
      .from("ride_status_history")
      .insert({ ride_id: ride.id, status: "in_progress" as never, changed_by: userId });

    return { ok: true as const, startedAt: updated.started_at, scheduledAt: ride.scheduled_at };
  });
