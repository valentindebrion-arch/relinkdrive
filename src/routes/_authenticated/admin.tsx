import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  LayoutDashboard,
  IdCard,
  Users,
  Car,
  Flag,
  Trophy,
  FileCheck2,
  LifeBuoy,
} from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/DashboardShell";
import { requireRoles } from "@/lib/role-guard";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: () => requireRoles(["admin", "superadmin"]),
  component: AdminLayout,
});

const items: NavItem[] = [
  { to: "/admin", label: "Vue d'ensemble", icon: <LayoutDashboard /> },
  { to: "/admin/utilisateurs", label: "Utilisateurs", icon: <Users /> },
  { to: "/admin/chauffeurs", label: "Chauffeurs", icon: <IdCard /> },
  { to: "/admin/inscriptions", label: "Demande inscription chauffeur", icon: <FileCheck2 /> },
  { to: "/admin/top10", label: "Top 10", icon: <Trophy /> },
  { to: "/admin/support", label: "Support", icon: <LifeBuoy /> },
  { to: "/admin/signalements", label: "Signalements", icon: <Flag /> },
];

function AdminLayout() {
  return (
    <DashboardShell items={items} area="Modération" brandTo="/admin">
      <Outlet />
    </DashboardShell>
  );
}
