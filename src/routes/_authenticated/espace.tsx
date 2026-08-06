import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, Users, Inbox, Car, Settings } from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/DashboardShell";
import { requireRoles } from "@/lib/role-guard";

export const Route = createFileRoute("/_authenticated/espace")({
  beforeLoad: () => requireRoles(["client", "admin", "superadmin"]),
  component: ClientLayout,
});

const items: NavItem[] = [
  { to: "/espace", label: "Accueil", icon: <LayoutDashboard /> },
  { to: "/espace/chauffeurs", label: "Mes chauffeurs", icon: <Users /> },
  { to: "/espace/demandes", label: "Commander", icon: <Inbox /> },
  { to: "/espace/courses", label: "Mes courses", icon: <Car /> },
  { to: "/espace/parametres", label: "Paramètres", icon: <Settings /> },
];

function ClientLayout() {
  return (
    <DashboardShell items={items} area="Espace client" settingsTo="/espace/parametres" hideBrand>
      <Outlet />
    </DashboardShell>
  );
}
