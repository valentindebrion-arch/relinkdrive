import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DriverSchedule } from "@/lib/schedule-slots";

const inputSchema = z.object({
  driverId: z.string().uuid(),
  pickup: z.string().trim().min(3).max(200),
  dropoff: z.string().trim().min(3).max(200),
  /** "YYYY-MM" du mois affiché dans l'agenda. */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  roundTrip: z.boolean().optional(),
});

type Input = z.infer<typeof inputSchema>;

/**
 * Agenda de réservation d'un chauffeur : jours et créneaux réellement
 * réservables, calculés à partir du planning réel (horaires, absences,
 * courses confirmées et demandes planifiées en attente).
 */
export const getDriverSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<DriverSchedule> => {
    const { buildDriverSchedule } = await import("@/lib/schedule-slots.server");
    return buildDriverSchedule(data, context.supabase, context.userId);
  });
