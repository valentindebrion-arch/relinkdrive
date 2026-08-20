/**
 * Contrôle serveur du forfait chauffeur. Une fonctionnalité Pro ne doit
 * jamais reposer sur le seul masquage d'écran : toute action réservée est
 * refusée ici avec l'erreur PRO_PLAN_REQUIRED.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const PRO_PLAN_REQUIRED = "PRO_PLAN_REQUIRED";

export class ProPlanRequiredError extends Error {
  code = PRO_PLAN_REQUIRED;
  constructor() {
    super("PRO_PLAN_REQUIRED : cette fonctionnalité est réservée à ReLink Pro.");
    this.name = "ProPlanRequiredError";
  }
}

/** Le chauffeur connecté doit disposer du forfait Pro. */
export async function requireProPlan(
  supabase: SupabaseClient<never>,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("driver_profiles")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if ((data as { plan?: string } | null)?.plan !== "pro") throw new ProPlanRequiredError();
}
