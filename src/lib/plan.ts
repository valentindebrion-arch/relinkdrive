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
  free: "ReLink Gratuit",
  pro: "ReLink Pro",
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

/** Fonctionnalités réservées à ReLink Pro. */
export type ProFeature =
  | "scheduled_rides"
  | "planning"
  | "clients"
  | "stats"
  | "ai"
  | "vehicle_tracking"
  | "custom_pricing";

export function planAllows(plan: DriverPlan | null | undefined, _feature: ProFeature) {
  return plan === "pro";
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
