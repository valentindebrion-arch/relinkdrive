import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, Users, Inbox, Car, Settings } from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/DashboardShell";

export const Route = createFileRoute("/_authenticated/espace")({
  component: ClientLayout,
});

const items: NavItem[] = [
  { to: "/espace", label: "Accueil", icon: <LayoutDashboard /> },
  { to: "/espace/chauffeurs", label: "Mes chauffeurs", icon: <Users /> },
  { to: "/espace/demandes", label: "Mes demandes", icon: <Inbox /> },
  { to: "/espace/courses", label: "Mes courses", icon: <Car /> },
  { to: "/espace/parametres", label: "Paramètres", icon: <Settings /> },
];

function ClientLayout() {
  return (
    <DashboardShell items={items} area="Espace client">
      <Outlet />
    </DashboardShell>
  );
}
