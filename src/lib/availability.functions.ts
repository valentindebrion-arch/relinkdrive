import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BLOCK_DURATION_MIN,
  SAFETY_MARGIN_MIN,
  SLOT_STEP_MIN,
  roundUpToSlot,
  type AvailabilityResult,
} from "@/lib/availability";

const ACTIVE_STATUSES = [
  "confirmed",
  "driver_enroute",
  "driver_arrived",
  "client_onboard",
  "in_progress",
] as const;

const inputSchema = z.object({
  driverIds: z.array(z.string().uuid()).min(1).max(8),
  pickup: z.string().trim().min(3).max(200),
  dropoff: z.string().trim().min(3).max(200),
  desiredIso: z.string().datetime(),
  /** Course à ignorer (re-vérification d'une demande déjà enregistrée). */
  ignoreRequestId: z.string().uuid().optional(),
});

type Input = z.infer<typeof inputSchema>;

export const checkDriverAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ results: AvailabilityResult[] }> => {
    const { supabase, userId } = context;

    // Le demandeur doit être le chauffeur lui-même, ou un client relié à ces chauffeurs.
    const { data: links } = await supabase
      .from("driver_client_connections")
      .select("driver_id")
      .eq("client_id", userId)
      .in("driver_id", data.driverIds);
    const allowed = new Set([
      ...(links ?? []).map((l) => l.driver_id),
      ...(data.driverIds.includes(userId) ? [userId] : []),
    ]);
    const driverIds = data.driverIds.filter((id) => allowed.has(id));
    if (!driverIds.length) throw new Error("Chauffeur indisponible pour cette vérification");

    const { travelMinutes } = await import("@/lib/travel-time.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const desired = new Date(data.desiredIso);
    const from = new Date(desired.getTime() - 12 * 3600_000).toISOString();
    const to = new Date(desired.getTime() + 24 * 3600_000).toISOString();

    const { data: rides } = await supabaseAdmin
      .from("rides")
      .select("id, request_id, driver_id, pickup_address, dropoff_address, scheduled_at, status, is_block")
      .in("driver_id", driverIds)
      .in("status", ACTIVE_STATUSES as unknown as string[])
      .gte("scheduled_at", from)
      .lte("scheduled_at", to)
      .order("scheduled_at");

    // Durée de la nouvelle course : calculée une seule fois pour tous les chauffeurs.
    const tripMin = await travelMinutes(data.pickup, data.dropoff, desired);

    const results: AvailabilityResult[] = [];
    for (const driverId of driverIds) {
      const planning = (rides ?? [])
        .filter((r) => r.driver_id === driverId && r.request_id !== (data.ignoreRequestId ?? null))
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

      const base: AvailabilityResult = {
        driverId,
        status: "unknown",
        earliestIso: null,
        repositionMin: null,
        tripMin,
        marginMin: SAFETY_MARGIN_MIN,
        reason: "",
      };

      if (tripMin === null) {
        results.push({ ...base, reason: "itineraire_nouvelle_course_indisponible" });
        continue;
      }

      const previous = [...planning].reverse().find((r) => new Date(r.scheduled_at) <= desired);
      const next = planning.find((r) => new Date(r.scheduled_at) > desired);

      // 1. Fin estimée de la course précédente + repositionnement + marge.
      let earliest = desired;
      let repositionMin: number | null = 0;
      if (previous) {
        const prevStart = new Date(previous.scheduled_at);
        let prevDuration = BLOCK_DURATION_MIN;
        if (!previous.is_block) {
          const d = await travelMinutes(previous.pickup_address, previous.dropoff_address, prevStart);
          if (d === null) {
            results.push({ ...base, reason: "itineraire_course_precedente_indisponible" });
            continue;
          }
          prevDuration = d;
        }
        const prevEnd = new Date(prevStart.getTime() + prevDuration * 60_000);
        const repo = previous.is_block
          ? 0
          : await travelMinutes(previous.dropoff_address, data.pickup, prevEnd);
        if (repo === null) {
          results.push({ ...base, reason: "repositionnement_indisponible" });
          continue;
        }
        repositionMin = repo;
        const readyAt = new Date(prevEnd.getTime() + (repo + SAFETY_MARGIN_MIN) * 60_000);
        if (readyAt > earliest) earliest = roundUpToSlot(readyAt, SLOT_STEP_MIN);
      }

      // 2. Contrainte de la course suivante.
      let latestStart: Date | null = null;
      if (next) {
        const nextStart = new Date(next.scheduled_at);
        const repoNext = next.is_block
          ? 0
          : await travelMinutes(data.dropoff, next.pickup_address, nextStart);
        if (repoNext === null) {
          results.push({ ...base, reason: "repositionnement_suivant_indisponible" });
          continue;
        }
        latestStart = new Date(
          nextStart.getTime() - (tripMin + repoNext + SAFETY_MARGIN_MIN) * 60_000,
        );
      }

      const feasible = (start: Date) => !latestStart || start <= latestStart;

      if (earliest.getTime() <= desired.getTime() && feasible(desired)) {
        results.push({
          ...base,
          status: "available",
          earliestIso: desired.toISOString(),
          repositionMin,
          reason: "ok",
        });
        continue;
      }
      if (feasible(earliest)) {
        results.push({
          ...base,
          status: "later",
          earliestIso: earliest.toISOString(),
          repositionMin,
          reason: previous ? "course_precedente_trop_proche" : "creneau_reporte",
        });
        continue;
      }
      results.push({
        ...base,
        status: "unavailable",
        repositionMin,
        reason: "course_suivante_incompatible",
      });
    }

    for (const r of results) {
      console.info(
        `[availability] driver=${r.driverId} status=${r.status} reason=${r.reason} repo=${r.repositionMin ?? "n/a"} trip=${r.tripMin ?? "n/a"}`,
      );
    }
    return { results };
  });
