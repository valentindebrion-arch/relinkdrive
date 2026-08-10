import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DRIVER_CANCEL_REASONS,
  PRE_START_STATUSES,
  driverCancelDeadline,
} from "@/lib/ride-cancel";

const PRE_START = [...PRE_START_STATUSES] as string[];
const NOT_PENDING = "cancel_request_status.is.null,cancel_request_status.neq.pending";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });
}

async function notify(
  userId: string,
  title: string,
  body: string,
  link: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    title,
    body,
    kind: "ride",
    link,
  });
}

/** Le client demande l'annulation : la course reste confirmée jusqu'à la décision du chauffeur. */
export const requestRideCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rideId: string; reason?: string }) =>
    z
      .object({ rideId: z.string().uuid(), reason: z.string().trim().max(300).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ride, error } = await supabase
      .from("rides")
      .select("id, client_id, driver_id, status, scheduled_at, started_at, completed_at, is_block, cancel_request_status")
      .eq("id", data.rideId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ride || ride.client_id !== userId || ride.is_block) throw new Error("Course introuvable");
    if (!ride.driver_id) throw new Error("Aucun chauffeur attribué à cette course");
    if (ride.started_at || ride.completed_at || !PRE_START.includes(ride.status)) {
      throw new Error("Cette course ne peut plus être annulée depuis l'application");
    }
    if (ride.cancel_request_status === "pending") {
      return { ok: true as const, alreadyPending: true as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("rides")
      .update({
        cancel_request_status: "pending",
        cancel_requested_at: new Date().toISOString(),
        cancel_requested_by: userId,
        cancel_request_reason: data.reason?.length ? data.reason : null,
        cancel_decided_at: null,
        cancel_decided_by: null,
      })
      .eq("id", ride.id)
      .eq("client_id", userId)
      .is("started_at", null)
      .in("status", PRE_START)
      .or(NOT_PENDING)
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updated) return { ok: true as const, alreadyPending: true as const };

    await notify(
      ride.driver_id,
      "Demande d'annulation du client",
      `Le client demande l'annulation de la course prévue le ${fmt(ride.scheduled_at)}.`,
      `/pro/courses/${ride.id}`,
    );

    return { ok: true as const, alreadyPending: false as const };
  });

/** Le chauffeur accepte ou refuse la demande d'annulation du client. */
export const decideRideCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rideId: string; decision: "accepted" | "refused" }) =>
    z
      .object({ rideId: z.string().uuid(), decision: z.enum(["accepted", "refused"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ride, error } = await supabase
      .from("rides")
      .select("id, client_id, driver_id, status, scheduled_at, started_at, completed_at, cancel_request_status")
      .eq("id", data.rideId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ride || ride.driver_id !== userId) throw new Error("Course introuvable");
    if (ride.cancel_request_status !== "pending") throw new Error("Aucune demande d'annulation en attente");
    if (ride.started_at || ride.completed_at || !PRE_START.includes(ride.status)) {
      throw new Error("La course a démarré : la demande ne peut plus être traitée ici");
    }

    const now = new Date().toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch =
      data.decision === "accepted"
        ? {
            status: "cancelled" as never,
            cancel_request_status: "accepted",
            cancel_decided_at: now,
            cancel_decided_by: userId,
            cancelled_at: now,
            cancelled_by: userId,
          }
        : { cancel_request_status: "refused", cancel_decided_at: now, cancel_decided_by: userId };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("rides")
      .update(patch)
      .eq("id", ride.id)
      .eq("driver_id", userId)
      .eq("cancel_request_status", "pending")
      .is("started_at", null)
      .in("status", PRE_START)
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updated) throw new Error("Cette demande a déjà été traitée");

    if (data.decision === "accepted") {
      await supabaseAdmin
        .from("ride_status_history")
        .insert({ ride_id: ride.id, status: "cancelled" as never, changed_by: userId });
    }

    if (ride.client_id) {
      await notify(
        ride.client_id,
        data.decision === "accepted" ? "Annulation acceptée" : "Annulation refusée",
        data.decision === "accepted"
          ? "Votre demande d'annulation a été acceptée."
          : "Le chauffeur n'a pas accepté la demande d'annulation. Votre course reste confirmée. Vous pouvez l'appeler pour trouver une solution.",
        `/espace/courses/${ride.id}`,
      );
    }

    return { ok: true as const, decision: data.decision };
  });

/** Annulation exceptionnelle par le chauffeur, au plus tard 30 min avant la prise en charge. */
export const driverCancelRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rideId: string; reason?: string }) =>
    z
      .object({
        rideId: z.string().uuid(),
        reason: z.enum(DRIVER_CANCEL_REASONS.map((r) => r.value) as [string, ...string[]]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ride, error } = await supabase
      .from("rides")
      .select("id, client_id, driver_id, status, scheduled_at, started_at, completed_at, is_block, cancel_request_status")
      .eq("id", data.rideId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ride || ride.driver_id !== userId || ride.is_block) throw new Error("Course introuvable");
    if (ride.started_at || ride.completed_at || !PRE_START.includes(ride.status)) {
      throw new Error("Cette course ne peut plus être annulée");
    }
    // Contrôle serveur des 30 minutes (heure serveur, indépendante du téléphone).
    if (Date.now() > driverCancelDeadline(ride.scheduled_at).getTime()) {
      throw new Error(
        "L'annulation autonome n'est plus disponible moins de 30 minutes avant la prise en charge. Contactez l'assistance.",
      );
    }

    const now = new Date().toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("rides")
      .update({
        status: "cancelled" as never,
        cancelled_at: now,
        cancelled_by: userId,
        cancellation_reason: data.reason ?? null,
        ...(ride.cancel_request_status === "pending"
          ? { cancel_request_status: "accepted", cancel_decided_at: now, cancel_decided_by: userId }
          : {}),
      })
      .eq("id", ride.id)
      .eq("driver_id", userId)
      .is("started_at", null)
      .in("status", PRE_START)
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updated) throw new Error("Cette course a déjà été mise à jour");

    await supabaseAdmin
      .from("ride_status_history")
      .insert({ ride_id: ride.id, status: "cancelled" as never, changed_by: userId });

    if (ride.client_id) {
      await notify(
        ride.client_id,
        "Course annulée par le chauffeur",
        `Le chauffeur a dû annuler votre course prévue le ${fmt(ride.scheduled_at)}.`,
        `/espace/courses/${ride.id}`,
      );
    }

    return { ok: true as const };
  });

/** Numéro professionnel du chauffeur, uniquement pour le client de la course et s'il est communicable. */
export const getRideDriverPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rideId: string }) => z.object({ rideId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ phone: string | null; name: string | null }> => {
    const { supabase, userId } = context;
    const { data: ride } = await supabase
      .from("rides")
      .select("id, client_id, driver_id")
      .eq("id", data.rideId)
      .maybeSingle();
    if (!ride || ride.client_id !== userId || !ride.driver_id) return { phone: null, name: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, { data: driverProfile }] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name").eq("id", ride.driver_id).maybeSingle(),
      supabaseAdmin
        .from("driver_profiles")
        .select("public_phone, show_public_phone")
        .eq("user_id", ride.driver_id)
        .maybeSingle(),
    ]);
    const phone =
      driverProfile?.show_public_phone && driverProfile.public_phone ? driverProfile.public_phone : null;
    return { phone, name: profile?.full_name ?? null };
  });
