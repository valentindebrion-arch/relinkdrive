import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/** Détails du dossier de vérification (champs hors tables métier existantes). */
export type DossierDetails = {
  driver_id: string;
  birth_date: string | null;
  postal_address: string | null;
  id_doc_type: string | null;
  id_doc_expires_on: string | null;
  license_number: string | null;
  license_categories: string | null;
  license_issued_on: string | null;
  license_expires_on: string | null;
  vtc_issued_on: string | null;
  vtc_expires_on: string | null;
  vtc_authority: string | null;
  trade_name: string | null;
  siren: string | null;
  revtc_number: string | null;
  rc_company: string | null;
  rc_contract: string | null;
  rc_starts_on: string | null;
  rc_expires_on: string | null;
  auto_company: string | null;
  auto_contract: string | null;
  auto_plate: string | null;
  auto_starts_on: string | null;
  auto_expires_on: string | null;
  registration_holder: string | null;
  certified_at: string | null;
};

export function useDossierDetails() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["dossier-details", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_dossier_details")
        .select("*")
        .eq("driver_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as DossierDetails | null;
    },
  });
}

export function useMyCompany() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-company", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("driver_id", user!.id)
        .order("created_at")
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

export function useMyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Enregistre (upsert) les détails du dossier du chauffeur connecté. */
export async function saveDossierDetails(driverId: string, patch: Partial<DossierDetails>) {
  const { error } = await supabase
    .from("driver_dossier_details")
    .upsert({ driver_id: driverId, ...patch } as never, { onConflict: "driver_id" });
  if (error) throw error;
}

/** Sépare un nom complet en prénom / nom pour le préremplissage. */
export function splitName(full?: string | null) {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "", last: "" };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

export const SIREN_RE = /^\d{9}$/;
export const SIRET_RE = /^\d{14}$/;

export function digitsOnly(v: string) {
  return v.replace(/\D/g, "");
}

/** Catégories de permis compatibles avec l'activité VTC. */
export const VTC_LICENSE_CATEGORIES = ["B", "B automatique", "B + BE", "D"];
