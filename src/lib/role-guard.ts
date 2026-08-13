import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/auth";

/** Charge les rôles de l'utilisateur courant (côté client uniquement). */
export async function fetchCurrentRoles(): Promise<{ userId: string; roles: AppRole[] } | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
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

/**
 * Seules ces pages restent accessibles au chauffeur tant que son compte
 * n'a pas été validé par un administrateur : dossier de validation et
 * saisie des informations obligatoires.
 */
const PRE_APPROVAL_ROUTES = [
  "/pro/dossier",
  "/pro/dossier/completer",
  "/pro/entreprise",
  "/pro/vehicule",
  "/pro/parametres",
  "/aide",
] as const;

/** Les anciennes valeurs et les lignes absentes restent toujours non validées. */
export function normalizeDriverVerificationStatus(status?: string | null) {
  if (!status || ["dossier_incomplet", "not_verified"].includes(status)) return "incomplete";
  return status;
}

export function isPreApprovalRoute(pathname: string) {
  const cleanPath = pathname.replace(/\/+$/, "") || "/";
  return PRE_APPROVAL_ROUTES.some(
    (route) => cleanPath === route || cleanPath.startsWith(`${route}/`),
  );
}

/**
 * Garde de l'espace chauffeur : bloque toutes les fonctions professionnelles
 * tant que le compte n'est pas au statut « verified ».
 */
export async function requireDriverAccess(pathname: string) {
  const current = await requireRoles(["driver", "admin", "superadmin"]);
  if (current.roles.includes("admin") || current.roles.includes("superadmin")) {
    return { ...current, driverActive: true };
  }
  const { data } = await supabase
    .from("driver_profiles")
    .select("verification_status")
    .eq("user_id", current.userId)
    .maybeSingle();
  const verificationStatus = normalizeDriverVerificationStatus(data?.verification_status);
  const driverActive = verificationStatus === "verified";
  if (!driverActive && !isPreApprovalRoute(pathname)) {
    throw redirect({ to: "/pro/dossier", replace: true });
  }
  return { ...current, driverActive, verificationStatus };
}
