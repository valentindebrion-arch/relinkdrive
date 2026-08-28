import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/** États possibles d'une section du dossier chauffeur. */
export type SectionState = "todo" | "review" | "approved" | "changes" | "expired";

export type DossierSection = {
  key: string;
  label: string;
  state: SectionState;
  missing: string[];
  docs: string[];
};

export type DossierState = {
  status: string;
  sections: DossierSection[];
  percent: number;
  complete: boolean;
  all_approved: boolean;
  submitted_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  suspension_reason: string | null;
};

/** Un chauffeur ne peut exercer sur ReLink que si l'administrateur a validé son dossier. */
export function isDriverActive(status?: string | null) {
  return status === "verified";
}

/**
 * Le dossier a été envoyé : le chauffeur accède à tout son espace pour
 * finaliser sa configuration pendant la vérification administrative.
 */
export function isDriverSubmitted(status?: string | null) {
  return !!status && status !== "incomplete";
}

export const SECTION_STATE_LABELS: Record<SectionState, string> = {
  todo: "À compléter",
  review: "À vérifier",
  approved: "Validé",
  changes: "Correction demandée",
  expired: "Expiré",
};

export const DOSSIER_STATUS_LABELS: Record<string, string> = {
  incomplete: "Dossier à compléter",
  pending: "Dossier envoyé",
  under_review: "Vérification en cours",
  changes_requested: "Corrections demandées",
  verified: "Compte validé",
  rejected: "Dossier refusé",
  suspended: "Compte suspendu",
  expired_documents: "Document expiré",
};

export async function fetchDossierState(driverId: string): Promise<DossierState> {
  const { data, error } = await supabase.rpc("driver_dossier_state", { _driver: driverId });
  if (error) throw error;
  return data as unknown as DossierState;
}

/** Progression réelle du dossier, calculée côté serveur. */
export function useDossierState(driverId?: string) {
  const { user } = useAuth();
  const id = driverId ?? user?.id;
  return useQuery({
    queryKey: ["dossier-state", id],
    enabled: !!id,
    queryFn: () => fetchDossierState(id!),
  });
}
