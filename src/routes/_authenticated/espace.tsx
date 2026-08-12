import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Inbox, Car, Settings, Home, UserRound } from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/DashboardShell";
import { ClientTabBar } from "@/components/ClientTabBar";
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

const bottomItems: NavItem[] = [
  { to: "/espace", label: "Accueil", icon: <Home /> },
  { to: "/espace/courses", label: "Courses", icon: <Car /> },
  { to: "/espace/chauffeurs", label: "Chauffeurs", icon: <Users /> },
  { to: "/espace/parametres", label: "Profil", icon: <UserRound /> },
];

function ClientLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/espace" || pathname === "/espace/";

  // Accueil : interface plein écran centrée sur la carte (sans header).
  if (isHome) {
    return (
      <div className="relative min-h-[100dvh] overflow-hidden bg-background">
        <Outlet />
        <ClientTabBar />
      </div>
    );
  }

  return (
    <DashboardShell
      items={items}
      bottomItems={bottomItems}
      area="Espace client"
      settingsTo="/espace/parametres"
      hideBrand
      hideNotifications
      brandTo="/espace"
    >
      <Outlet />
    </DashboardShell>
  );
}
