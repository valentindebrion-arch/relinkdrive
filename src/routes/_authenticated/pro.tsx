import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Home, Car, Users, Receipt, Bot, UserRound } from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/DashboardShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { requireRoles } from "@/lib/role-guard";

export const Route = createFileRoute("/_authenticated/pro")({
  beforeLoad: () => requireRoles(["driver", "admin", "superadmin"]),
  component: ProLayout,
});

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

function ProLayout() {
  const { isDriver, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const newRequests = useNewRequestsCount();

  useEffect(() => {
    if (!loading && !isDriver && !isAdmin) navigate({ to: "/espace", replace: true });
  }, [loading, isDriver, isAdmin, navigate]);

  const badge = newRequests.data || undefined;

  const items: NavItem[] = [
    { to: "/pro", label: "Accueil", icon: <Home /> },
    { to: "/pro/courses", label: "Mes courses", icon: <Car />, badge },
    { to: "/pro/clients", label: "Mes clients", icon: <Users /> },
    { to: "/pro/factures", label: "Facturation", icon: <Receipt /> },
    { to: "/pro/assistant", label: "Assistant", icon: <Bot /> },
    { to: "/pro/profil", label: "Mon profil", icon: <UserRound /> },
  ];

  const bottomItems: NavItem[] = [
    { to: "/pro", label: "Accueil", icon: <Home /> },
    { to: "/pro/courses", label: "Courses", icon: <Car />, badge },
    { to: "/pro/clients", label: "Clients", icon: <Users /> },
    { to: "/pro/assistant", label: "Assistant", icon: <Bot /> },
    { to: "/pro/profil", label: "Profil", icon: <UserRound /> },
  ];

  return (
    <DashboardShell items={items} bottomItems={bottomItems} area="Espace chauffeur" settingsTo="/pro/profil">
      <Outlet />
    </DashboardShell>
  );
}
