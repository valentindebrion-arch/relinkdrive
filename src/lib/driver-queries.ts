import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useDriverProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["driver-profile", user?.id],
    enabled: !!user?.id,
    // Le statut de validation peut changer côté admin : on le resynchronise régulièrement.
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMyVehicle() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-vehicle", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("driver_id", user!.id)
        .order("created_at")
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

export function useMyDocuments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-documents", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verification_documents")
        .select("*")
        .eq("driver_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNewRequestsCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["driver-new-requests", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("ride_requests")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", user!.id)
        .in("status", ["new", "reviewing", "awaiting_client", "proposal_sent"]);
      return count ?? 0;
    },
  });
}
