import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DayPlan } from "@/lib/day-planning";

const inputSchema = z.object({
  /** "YYYY-MM-DD" (Europe/Paris) */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type Input = z.infer<typeof inputSchema>;

/** Planning réel du chauffeur connecté pour une journée donnée. */
export const getDriverDayPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<DayPlan> => {
    const { requireProPlan } = await import("@/lib/plan-guard.server");
    await requireProPlan(context.supabase as never, context.userId);
    const { buildDayPlan } = await import("@/lib/day-planning.server");
    return buildDayPlan(data.date, context.supabase, context.userId);
  });

