import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Inbox,
  CalendarDays,
  Users,
  Car,
  Receipt,
  Building2,
  QrCode,
  Activity,
  Bot,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { requireRoles } from "@/lib/role-guard";

export const Route = createFileRoute("/_authenticated/pro")({
  beforeLoad: () => requireRoles(["driver", "admin", "superadmin"]),
  component: ProLayout,
});

const items: NavItem[] = [
  { to: "/pro", label: "Vue d'ensemble", icon: <LayoutDashboard /> },
  { to: "/pro/demandes", label: "Demandes", icon: <Inbox /> },
  { to: "/pro/planning", label: "Planning", icon: <CalendarDays /> },
  { to: "/pro/clients", label: "Clients", icon: <Users /> },
  { to: "/pro/courses", label: "Courses", icon: <Car /> },
  { to: "/pro/factures", label: "Factures", icon: <Receipt /> },
  { to: "/pro/entreprise", label: "Mon entreprise", icon: <Building2 /> },
  { to: "/pro/vehicule", label: "Mon véhicule", icon: <Car /> },
  { to: "/pro/verification", label: "Vérification", icon: <ShieldCheck /> },
  { to: "/pro/qr", label: "Mon QR code", icon: <QrCode /> },
  { to: "/pro/activite", label: "Activité", icon: <Activity /> },
  { to: "/pro/assistant", label: "Assistant", icon: <Bot /> },
  { to: "/pro/parametres", label: "Paramètres", icon: <Settings /> },
];

function ProLayout() {
  const { isDriver, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isDriver && !isAdmin) navigate({ to: "/espace", replace: true });
  }, [loading, isDriver, isAdmin, navigate]);

  return (
    <DashboardShell items={items} area="Espace chauffeur" settingsTo="/pro/parametres">
      <Outlet />
    </DashboardShell>
  );
}
