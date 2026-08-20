import { useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Home, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/** Trois univers : Mes chauffeurs ← Accueil → Trouver un chauffeur. */
const TABS = [
  { to: "/espace/chauffeurs", label: "Mes chauffeurs", icon: Users },
  { to: "/espace", label: "Accueil", icon: Home },
  { to: "/espace/decouvrir", label: "Trouver", icon: Compass },
] as const;

/** Navigation principale fixe de l'espace client. */
export function ClientTabBar({ disabled = false }: { disabled?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastNav = useRef(0);

  return (
    <nav
      aria-label="Navigation principale"
      aria-busy={disabled || undefined}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 shadow-[0_-1px_12px_rgba(0,0,0,0.04)] backdrop-blur ${disabled ? "pointer-events-none" : ""}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map((tab) => {
          const active =
            tab.to === "/espace"
              ? pathname === "/espace" || pathname === "/espace/"
              : pathname.startsWith(tab.to);
          return (
            <li key={tab.to} className="flex-1">
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
                  "relative flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors duration-200",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1.5 h-8 w-16 rounded-full bg-primary/8 transition-opacity duration-200",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
                <tab.icon
                  className={cn(
                    "relative size-5 transition-transform duration-200",
                    active ? "-translate-y-0.5" : "translate-y-0",
                  )}
                />
                <span className="relative">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
