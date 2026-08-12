import { useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Car, Users, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/espace", label: "Accueil", icon: Home },
  { to: "/espace/courses", label: "Courses", icon: Car },
  { to: "/espace/chauffeurs", label: "Chauffeurs", icon: Users },
  { to: "/espace/parametres", label: "Profil", icon: UserRound },
] as const;

/** Navigation principale fixe de l'espace client (4 onglets). */
export function ClientTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastNav = useRef(0);

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 shadow-[0_-1px_12px_rgba(0,0,0,0.04)] backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map((tab) => {
          const active =
            pathname === tab.to || (tab.to !== "/espace" && pathname.startsWith(tab.to));
          return (
            <li key={tab.to} className="flex-1">
              <Link
                to={tab.to}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  const now = Date.now();
                  if (!active && now - lastNav.current < 300) {
                    e.preventDefault();
                    return;
                  }
                  lastNav.current = now;
                }}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <tab.icon className="size-5" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
