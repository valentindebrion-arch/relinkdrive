import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ClientShell } from "@/components/ClientShell";
import { ClientTabBar } from "@/components/ClientTabBar";
import { requireRoles } from "@/lib/role-guard";

export const Route = createFileRoute("/_authenticated/espace")({
  beforeLoad: () => requireRoles(["client", "admin", "superadmin"]),
  component: ClientLayout,
});

function ClientLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/espace" || pathname === "/espace/";
  // Formulaire de demande : parcours plein écran, sans logo ni onglets.
  const isRequestFlow = pathname.startsWith("/espace/demandes");

  if (isRequestFlow) return <Outlet />;

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
    <ClientShell>
      <Outlet />
    </ClientShell>
  );
}
