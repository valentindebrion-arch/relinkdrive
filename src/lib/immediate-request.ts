import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Demande « Maintenant » bloquante du client connecté.
 * La vérité vient toujours du serveur (fonction SECURITY DEFINER filtrée sur auth.uid()).
 */
export type BlockingImmediate = {
  request_id: string;
  ride_id: string | null;
  status: string;
  kind: "request" | "ride";
  driver_id: string | null;
  driver_first_name: string | null;
  created_at: string;
  can_cancel: boolean;
  /** Échéance serveur de réponse du chauffeur (10 min) pour les demandes « Maintenant ». */
  response_deadline: string | null;
};

export const BLOCKING_QUERY_KEY = "blocking-immediate";

export function useBlockingImmediate() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [BLOCKING_QUERY_KEY, user?.id],
    enabled: !!user?.id,
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<BlockingImmediate | null> => {
      const { data, error } = await supabase.rpc("get_blocking_immediate_request");
      if (error) throw error;
      const row = (data ?? [])[0] as BlockingImmediate | undefined;
      return row ?? null;
    },
  });
}

export function newIdempotencyKey() {
  try {
    return crypto.randomUUID();
  } catch {
    return `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
