/**
 * Modèle d'offre chauffeur ReLink : Gratuit (tarif imposé, Courses Flash) et
 * Pro (tarification personnalisée, courses planifiées, outils professionnels).
 * Les règles ci-dessous ne sont qu'un miroir de celles appliquées côté serveur
 * (triggers SQL + compute_ride_quote) : l'interface ne fait jamais autorité.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type DriverPlan = "free" | "pro";

/** Tarif kilométrique imposé par ReLink aux chauffeurs Gratuit. */
export const FREE_PRICE_PER_KM = 1.85;
/** Plafond absolu du tarif kilométrique personnalisé (ReLink Pro). */
export const MAX_PRICE_PER_KM = 3.0;
export const PRO_PRICE_PER_MONTH = 120;

export const PLAN_LABELS: Record<DriverPlan, string> = {
  free: "ReLink Standard",
  pro: "ReLink Pro",
};

/** Libellé court utilisé dans les badges et tableaux. */
export const PLAN_SHORT_LABELS: Record<DriverPlan, string> = {
  free: "Standard / Gratuit",
  pro: "Pro",
};

export const PRO_TAGLINE = "Vos clients. Vos tarifs. 0 % de commission.";

export const FREE_FEATURES = [
  "Fiche publique chauffeur",
  "QR code personnel ReLink",
  "Courses Flash (accepter ou refuser)",
  "0 % de commission",
  "Tarif ReLink imposé : 1,85 €/km",
];

export const PRO_FEATURES = [
  "Courses Flash et courses planifiées",
  "Agenda, planning et disponibilités",
  "Gestion de la clientèle ReLink",
  "Statistiques d'activité et chiffre d'affaires",
  "Suivi véhicule et analyse IA",
  "Visibilité renforcée dans « La crème de la crème »",
  "Tarifs personnalisés jusqu'à 3,00 €/km",
  "0 % de commission",
];

/**
 * Système central de permissions : le forfait du chauffeur est la seule
 * source de vérité. Aucune règle d'accès ne doit être réécrite écran par
 * écran ; on interroge toujours `planPermissions()` / `useProAccess()`.
 * Le backend applique les mêmes règles (triggers SQL + requireProPlan).
 */
export type DriverPermission =
  | "canAccessFlashRides"
  | "canAccessScheduledRides"
  | "canAccessPlanning"
  | "canAccessAvailability"
  | "canAccessClients"
  | "canAccessAnalytics"
  | "canAccessAI"
  | "canAccessVehicleTracking"
  | "canAccessCustomPricing"
  | "canAccessBranding";

const PRO_ONLY_PERMISSIONS: DriverPermission[] = [
  "canAccessScheduledRides",
  "canAccessPlanning",
  "canAccessAvailability",
  "canAccessClients",
  "canAccessAnalytics",
  "canAccessAI",
  "canAccessVehicleTracking",
  "canAccessCustomPricing",
  "canAccessBranding",
];

export type DriverPermissions = Record<DriverPermission, boolean>;

export function planPermissions(plan: DriverPlan | null | undefined): DriverPermissions {
  const pro = plan === "pro";
  const base = { canAccessFlashRides: true } as DriverPermissions;
  for (const key of PRO_ONLY_PERMISSIONS) base[key] = pro;
  return base;
}

/** Une fonctionnalité est-elle autorisée pour ce forfait ? */
export function planAllows(plan: DriverPlan | null | undefined, feature: DriverPermission) {
  return planPermissions(plan)[feature];
}

/** Chemins de l'espace chauffeur réservés à ReLink Pro. */
export const PRO_ONLY_PATHS: { path: string; label: string; permission: DriverPermission }[] = [
  { path: "/pro/planning", label: "Planning", permission: "canAccessPlanning" },
  { path: "/pro/disponibilites", label: "Disponibilités", permission: "canAccessAvailability" },
  { path: "/pro/clients", label: "Mes clients", permission: "canAccessClients" },
  { path: "/pro/assistant", label: "Analyse IA", permission: "canAccessAI" },
  { path: "/pro/activite", label: "Statistiques", permission: "canAccessAnalytics" },
  { path: "/pro/personnalisation", label: "Personnalisation", permission: "canAccessBranding" },
];

export function proOnlyPathFor(pathname: string) {
  return PRO_ONLY_PATHS.find((p) => pathname === p.path || pathname.startsWith(p.path + "/")) ?? null;
}

export function normalizePlan(value: unknown): DriverPlan {
  return value === "pro" ? "pro" : "free";
}


/** Offre du chauffeur connecté. */
export function useMyPlan() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["driver-plan", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select("plan, plan_started_at, plan_renews_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      const row = (data ?? null) as Record<string, unknown> | null;
      return {
        plan: normalizePlan(row?.["plan"]),
        started_at: (row?.["plan_started_at"] as string | null) ?? null,
        renews_at: (row?.["plan_renews_at"] as string | null) ?? null,
      };
    },
  });
  return { ...query, plan: query.data?.plan ?? "free", isPro: query.data?.plan === "pro" };
}

/** Le chauffeur choisi accepte-t-il les courses planifiées ? (Pro uniquement) */
export function useDriverSupportsScheduled(driverId: string | null | undefined) {
  return useQuery({
    queryKey: ["driver-supports-scheduled", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("driver_supports_scheduled", {
        _driver: driverId,
      } as never);
      if (error) throw error;
      return Boolean(data);
    },
  });
}

export type TariffSettings = {
  price_per_km_ht: number;
  minimum_ht: number;
  pickup_pct: number;
  night_enabled: boolean;
  night_start: string;
  night_end: string;
  night_pct: number;
};

export type TariffSimulation = {
  km: number;
  kmAmount: number;
  base: number;
  pickupAmount: number;
  nightAmount: number;
  total: number;
};

/** Même formule que la fonction SQL compute_ride_quote (hors TVA). */
export function simulateTariff(
  settings: TariffSettings,
  km: number,
  nightApplied: boolean,
): TariffSimulation {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const kmAmount = round2(km * settings.price_per_km_ht);
  const base = Math.max(settings.minimum_ht, kmAmount);
  const pickupAmount = round2((base * settings.pickup_pct) / 100);
  const nightAmount = nightApplied ? round2((base * settings.night_pct) / 100) : 0;
  return {
    km,
    kmAmount,
    base,
    pickupAmount,
    nightAmount,
    total: Math.ceil(base + pickupAmount + nightAmount),
  };
}
