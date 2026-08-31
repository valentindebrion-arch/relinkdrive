import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/auth";

/** Charge les rôles de l'utilisateur courant (côté client uniquement). */
export async function fetchCurrentRoles(): Promise<{ userId: string; roles: AppRole[] } | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: rows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  return { userId: data.user.id, roles: ((rows ?? []) as { role: AppRole }[]).map((r) => r.role) };
}

/** Espace d'accueil autorisé pour un jeu de rôles donné. */
export function homeForRolesSafe(roles: AppRole[]): string {
  if (roles.includes("admin") || roles.includes("superadmin")) return "/admin";
  if (roles.includes("driver")) return "/pro";
  return "/espace";
}

/**
 * Garde de route stricte : redirige vers /auth si non connecté,
 * vers l'espace correspondant au rôle si l'accès n'est pas autorisé.
 */
export async function requireRoles(allowed: AppRole[]) {
  const current = await fetchCurrentRoles();
  if (!current) throw redirect({ to: "/auth" });
  const ok = current.roles.some((r) => allowed.includes(r));
  if (!ok) throw redirect({ to: homeForRolesSafe(current.roles) });
  return current;
}

/** Les anciennes valeurs et les lignes absentes restent toujours non validées. */
export function normalizeDriverVerificationStatus(status?: string | null) {
  if (!status || ["dossier_incomplet", "not_verified"].includes(status)) return "incomplete";
  return status;
}

/**
 * Garde de l'espace chauffeur : la vérification administrative n'est plus une
 * condition d'utilisation, seul le rôle est contrôlé.
 */
export async function requireDriverAccess(_pathname?: string) {
  const current = await requireRoles(["driver", "admin", "superadmin"]);
  return { ...current, driverActive: true };
}
