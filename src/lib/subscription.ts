/**
 * Abonnement chauffeur vu par l'administration : distinction entre l'accès
 * fonctionnel (plan) et l'état de facturation (billing_status), historique des
 * changements et accès Pro temporaire. Toutes les règles sont appliquées côté
 * serveur par la fonction SQL admin_set_driver_plan : l'UI n'est qu'un miroir.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DriverPlan } from "@/lib/plan";

export type BillingStatus = "free" | "active" | "trial" | "complimentary" | "past_due" | "canceled";

export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  free: "Gratuit",
  active: "Abonnement actif",
  trial: "Période d'essai",
  complimentary: "Pro offert",
  past_due: "Paiement en anomalie",
  canceled: "Abonnement expiré",
};

/** Natures possibles d'un passage en Pro décidé par l'administration. */
export const PRO_BILLING_CHOICES: { value: BillingStatus; label: string; hint: string }[] = [
  { value: "active", label: "Abonnement payé", hint: "Facturation normale à 120 €/mois." },
  { value: "complimentary", label: "Abonnement offert", hint: "Aucun paiement généré." },
  { value: "trial", label: "Période d'essai", hint: "Accès Pro temporaire d'évaluation." },
  {
    value: "past_due",
    label: "Paiement en anomalie",
    hint: "Accès maintenu, paiement à régulariser.",
  },
];

/** Motifs proposés pour tracer la décision administrative. */
export const PLAN_REASONS = [
  "Abonnement payé normalement",
  "Abonnement offert",
  "Période d'essai",
  "Geste commercial",
  "Partenariat",
  "Compte interne / test",
];

export function normalizeBillingStatus(value: unknown): BillingStatus {
  const v = String(value ?? "free");
  return (Object.keys(BILLING_STATUS_LABELS) as BillingStatus[]).includes(v as BillingStatus)
    ? (v as BillingStatus)
    : "free";
}

export type PlanFilter =
  "all" | "free" | "pro" | "complimentary" | "trial" | "canceled" | "past_due";

export const PLAN_FILTER_LABELS: Record<PlanFilter, string> = {
  all: "Tous les chauffeurs",
  free: "Gratuit",
  pro: "Pro",
  complimentary: "Pro offert",
  trial: "Période d'essai",
  canceled: "Abonnement expiré",
  past_due: "Paiement en anomalie",
};

export function matchesPlanFilter(
  filter: PlanFilter,
  row: { plan: DriverPlan; billing_status: BillingStatus },
) {
  if (filter === "all") return true;
  if (filter === "free") return row.plan === "free";
  if (filter === "pro") return row.plan === "pro";
  return row.billing_status === filter;
}

export type DriverSubscription = {
  plan: DriverPlan;
  billing_status: BillingStatus;
  plan_reason: string | null;
  plan_started_at: string | null;
  plan_expires_at: string | null;
};

/** Abonnement courant d'un chauffeur (lecture admin). */
export function useDriverSubscription(driverId: string) {
  return useQuery({
    queryKey: ["admin", "driver-subscription", driverId],
    queryFn: async (): Promise<DriverSubscription> => {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select("plan, billing_status, plan_reason, plan_started_at, plan_expires_at")
        .eq("user_id", driverId)
        .maybeSingle();
      if (error) throw error;
      return {
        plan: data?.plan === "pro" ? "pro" : "free",
        billing_status: normalizeBillingStatus(data?.billing_status),
        plan_reason: data?.plan_reason ?? null,
        plan_started_at: data?.plan_started_at ?? null,
        plan_expires_at: data?.plan_expires_at ?? null,
      };
    },
  });
}

export type PlanChange = {
  id: string;
  old_plan: string;
  new_plan: string;
  old_billing_status: string | null;
  new_billing_status: string | null;
  reason: string | null;
  expires_at: string | null;
  changed_by: string | null;
  source: string;
  created_at: string;
  actor_name?: string | null;
};

/** Historique des changements d'abonnement, du plus récent au plus ancien. */
export function useSubscriptionHistory(driverId: string) {
  return useQuery({
    queryKey: ["admin", "driver-plan-history", driverId],
    queryFn: async (): Promise<PlanChange[]> => {
      const { data, error } = await supabase
        .from("driver_plan_changes")
        .select("*")
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as PlanChange[];
      const actorIds = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))] as string[];
      if (!actorIds.length) return rows;
      const { data: actors } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);
      return rows.map((r) => ({
        ...r,
        actor_name:
          (actors ?? []).find((a) => a.id === r.changed_by)?.full_name ??
          (r.source === "system" ? "Automatique" : "Administrateur"),
      }));
    },
  });
}

export type PlanChangeInput = {
  driverId: string;
  plan: DriverPlan;
  billingStatus: BillingStatus;
  reason: string;
  expiresAt?: string | null;
  restoreTariffs?: boolean;
};

/** Applique un changement d'abonnement (RPC sécurisée, admin uniquement). */
export function useChangeDriverPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlanChangeInput) => {
      const { error } = await supabase.rpc("admin_set_driver_plan", {
        _driver: input.driverId,
        _plan: input.plan,
        _billing_status: input.billingStatus,
        _reason: input.reason || null,
        _expires_at: input.expiresAt ?? null,
        _restore_tariffs: input.restoreTariffs ?? true,
      } as never);
      if (error) throw error;
    },
    onSuccess: (_r, input) => {
      void qc.invalidateQueries({ queryKey: ["admin"] });
      void qc.invalidateQueries({ queryKey: ["driver-plan"] });
      void qc.invalidateQueries({ queryKey: ["driver-supports-scheduled", input.driverId] });
    },
  });
}

/** Date ISO correspondant à une durée en jours à partir de maintenant. */
export function daysFromNowIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function formatPlanDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
