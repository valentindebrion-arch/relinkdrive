/**
 * Accès aux profils des parties liées (client ↔ chauffeur).
 *
 * La table `profiles` n'est plus lisible directement par la contrepartie :
 * la fonction `get_connected_profiles` ne renvoie que les champs nécessaires
 * (nom, photo) et les coordonnées uniquement au chauffeur du client.
 */
import { supabase } from "@/integrations/supabase/client";

export type ConnectedProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
};

type RpcFn = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: ConnectedProfile[] | null; error: { message: string } | null }>;

export async function fetchConnectedProfiles(
  ids: (string | null | undefined)[],
): Promise<ConnectedProfile[]> {
  const list = Array.from(new Set(ids.filter((id): id is string => !!id)));
  if (!list.length) return [];
  const { data, error } = await (supabase.rpc as unknown as RpcFn)("get_connected_profiles", {
    _ids: list,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchConnectedProfile(id?: string | null): Promise<ConnectedProfile | null> {
  if (!id) return null;
  const [first] = await fetchConnectedProfiles([id]);
  return first ?? null;
}
