import { useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Home, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/** Trois univers : Mes chauffeurs · Accueil · Trouver. */
const TABS = [
  { to: "/espace/chauffeurs", label: "Mes chauffeurs", icon: Users },
  { to: "/espace", label: "Accueil", icon: Home },
  { to: "/espace/decouvrir", label: "Trouver", icon: Compass },
] as const;

/** Navigation principale fixe de l'espace client.
 * Sur mobile, seul l'onglet actif affiche son libellé afin de garder un dock léger.
 */
export function ClientTabBar({ disabled = false }: { disabled?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastNav = useRef(0);

  return (
    <nav
      aria-label="Navigation principale"
      aria-busy={disabled || undefined}
      className={`client-tabbar fixed bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/80 bg-card/88 shadow-[0_18px_50px_-22px_rgba(9,54,37,.45)] backdrop-blur-xl ${disabled ? "pointer-events-none" : ""}`}
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-center gap-1 p-1.5">
        {TABS.map((tab) => {
          const active =
            tab.to === "/espace"
              ? pathname === "/espace" || pathname === "/espace/"
              : pathname.startsWith(tab.to);
          return (
            <li key={tab.to}>
              <Link
                to={tab.to}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  if (disabled) {
                    e.preventDefault();
                    return;
                  }
                  const now = Date.now();
                  if (!active && now - lastNav.current < 380) {
                    e.preventDefault();
                    return;
                  }
                  lastNav.current = now;
                }}
                className={cn(
                  "client-tabbar-link relative flex items-center justify-center text-[12px] font-bold transition-all duration-300",
                  active
                    ? "is-active bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <tab.icon
                  className={cn(
                    "client-tabbar-icon relative size-[19px] shrink-0 transition-transform duration-300",
                    active ? "scale-105" : "scale-100",
                  )}
                />
                <span className="client-tabbar-label relative whitespace-nowrap">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
