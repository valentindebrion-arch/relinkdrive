import type { ReactNode } from "react";
import { ClientTabBar } from "@/components/ClientTabBar";

/**
 * Coque de l'espace client : pas de header, pas de menu burger, pas de logo.
 * Chaque page commence directement par son titre ou son bouton retour.
 */
export function ClientShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-background">
      <main
        className="w-full max-w-full overflow-x-hidden px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>

      <ClientTabBar />
    </div>
  );
}
