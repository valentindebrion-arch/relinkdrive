import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { ClientPageTransition } from "@/components/ClientPageTransition";
import { ClientSplash } from "@/components/ClientSplash";
import { ClientTabBar } from "@/components/ClientTabBar";
import { requireRoles } from "@/lib/role-guard";

export const Route = createFileRoute("/_authenticated/espace")({
  beforeLoad: () => requireRoles(["client", "admin", "superadmin"]),
  component: ClientLayout,
});

function ClientLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [transitioning, setTransitioning] = useState(false);
  const handleTransitionChange = useCallback((running: boolean) => setTransitioning(running), []);
  const isHome = pathname === "/espace" || pathname === "/espace/";
  // Formulaire de demande : parcours plein écran, sans logo ni onglets.
  const isRequestFlow = pathname.startsWith("/espace/demandes");

  if (isRequestFlow)
    return (
      <>
        <ClientSplash />
        <Outlet />
      </>
    );

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-background">
      <ClientSplash />
      <ClientPageTransition onTransitionChange={handleTransitionChange}>
        {isHome ? (
          <Outlet />
        ) : (
          <main
            className="w-full max-w-full overflow-x-hidden px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-4"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
          >
            <div className="mx-auto w-full max-w-3xl">
              <Outlet />
            </div>
          </main>
        )}
      </ClientPageTransition>
      <ClientTabBar disabled={transitioning} />
    </div>
  );
}
