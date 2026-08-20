import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, IdCard, Users, Car, Flag } from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/DashboardShell";
import { requireRoles } from "@/lib/role-guard";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: () => requireRoles(["admin", "superadmin"]),
  component: AdminLayout,
});

const items: NavItem[] = [
  { to: "/admin", label: "Vue d'ensemble", icon: <LayoutDashboard /> },
  { to: "/admin/chauffeurs", label: "Vérification chauffeurs", icon: <ShieldCheck /> },
  { to: "/admin/utilisateurs", label: "Utilisateurs", icon: <Users /> },
  { to: "/admin/courses", label: "Courses", icon: <Car /> },
  { to: "/admin/signalements", label: "Signalements", icon: <Flag /> },
];

function AdminLayout() {
  return (
    <DashboardShell items={items} area="Modération" brandTo="/admin">
      <Outlet />
    </DashboardShell>
  );
}
