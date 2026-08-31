import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Home, QrCode, HelpCircle } from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/DashboardShell";
import { ClientPageTransition } from "@/components/ClientPageTransition";
import { useAuth } from "@/lib/auth";
import { requireDriverAccess } from "@/lib/role-guard";

// Espace chauffeur simplifié : tout converge vers la vitrine publique.
const PRO_TAB_ORDER = ["/pro", "/pro/qr", "/aide"];
const PRO_TAB_KEYS = ["pro-home", "pro-qr", "pro-help"];

export const Route = createFileRoute("/_authenticated/pro")({
  beforeLoad: ({ location }) => requireDriverAccess(location.pathname),
  component: ProLayout,
});

function ProLayout() {
  const { isDriver, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isDriver && !isAdmin) navigate({ to: "/espace", replace: true });
  }, [loading, isDriver, isAdmin, navigate]);

  const items: NavItem[] = [
    { to: "/pro", label: "Ma vitrine", icon: <Home /> },
    { to: "/pro/qr", label: "QR code & partage", icon: <QrCode /> },
    { to: "/aide", label: "Aide", icon: <HelpCircle /> },
  ];

  const bottomItems: NavItem[] = [
    { to: "/pro", label: "Vitrine", icon: <Home /> },
    { to: "/pro/qr", label: "QR code", icon: <QrCode /> },
    { to: "/aide", label: "Aide", icon: <HelpCircle /> },
  ];

  return (
    <DashboardShell items={items} bottomItems={bottomItems} area="Espace chauffeur" brandTo="/pro">
      <ClientPageTransition tabOrder={PRO_TAB_ORDER} tabKeys={PRO_TAB_KEYS} bottomOffset="5.5rem">
        <Outlet />
      </ClientPageTransition>
    </DashboardShell>
  );
}
