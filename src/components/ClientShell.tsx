import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { ClientTabBar } from "@/components/ClientTabBar";

/**
 * Coque de l'espace client : pas de header ni de menu burger.
 * Uniquement la capsule ReLink centrée en haut + la barre d'onglets fixe.
 */
export function ClientShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-background">
      <div
        className="flex justify-center px-3 pb-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <span className="rounded-full bg-card/95 px-3.5 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] backdrop-blur">
          <BrandLogo to="/espace" size="sm" />
        </span>
      </div>

      <main className="w-full max-w-full overflow-x-hidden px-3 pt-1 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-4">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>

      <ClientTabBar />
    </div>
  );
}
