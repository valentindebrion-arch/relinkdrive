import { supabase } from "@/integrations/supabase/client";

/**
 * Retourne l'identifiant de l'unique véhicule du chauffeur, en le créant si besoin.
 *
 * RÈGLE CRITIQUE ReLink : on ne crée jamais une seconde ligne véhicule « à
 * l'aveugle ». Une ligne dupliquée reviendrait à faire disparaître les photos
 * déjà enregistrées (l'application n'en lit qu'une seule). On relit donc
 * toujours la base avant d'insérer.
 */
export async function ensureVehicleRowId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("id")
    .eq("driver_id", userId)
    .order("is_primary", { ascending: false })
    .order("created_at")
    .limit(1);
  if (error) throw error;
  if (data?.[0]?.id) return data[0].id;

  const { data: created, error: insertError } = await supabase
    .from("vehicles")
    .insert({ driver_id: userId })
    .select("id")
    .single();
  if (insertError) throw insertError;
  return created.id;
}
