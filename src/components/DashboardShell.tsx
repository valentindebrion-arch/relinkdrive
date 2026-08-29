import { useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Menu, LogOut, UserRound, X, Lock } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/NotificationBell";
import { BrandLogo } from "@/components/BrandLogo";

export type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: number | undefined;
  /** Fonctionnalité visible mais réservée à ReLink Pro. */
  locked?: boolean;
};

export function DashboardShell({
  items,
  area,
  children,
  dense = false,
  settingsTo,
  bottomItems,
  hideBrand = false,
  brandTo,
  hideNotifications = false,
}: {
  items: NavItem[];
  area: string;
  children: ReactNode;
  dense?: boolean;
  settingsTo?: string;
  bottomItems?: NavItem[];
  hideBrand?: boolean;
  brandTo?: string;
  /** Masque uniquement l'UI des notifications internes (le système reste en place). */
  hideNotifications?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active =
          pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to + "/"));
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              dense ? "py-1.5" : "py-2",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <span className="shrink-0 [&_svg]:size-4">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.locked ? (
              <span className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                <Lock className="size-3" /> PRO
              </span>
            ) : null}
            {item.badge ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <div className="mb-6">
          <BrandLogo to={brandTo ?? "/"} />
          {hideBrand ? null : <p className="mt-1 text-xs text-muted-foreground">{area}</p>}
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {hideNotifications ? null : (
          <div className="mt-4 flex items-center gap-2 border-t border-sidebar-border pt-3">
            <NotificationBell />
            <span className="text-xs text-muted-foreground">Notifications</span>
          </div>
        )}
        {settingsTo ? (
          <Link
            to={settingsTo}
            className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <UserRound className="size-4" />
            <span className="truncate">{profile?.full_name?.split(" ")[0] ?? "Mon compte"}</span>
          </Link>
        ) : null}
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/auth", replace: true });
          }}
          className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          <LogOut className="size-4" /> Déconnexion
        </button>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
          <Menu className="size-5" />
        </button>
        <BrandLogo to={brandTo ?? "/"} size="sm" className="min-w-0" />
        <div className="flex items-center gap-1">
          {hideNotifications ? null : <NotificationBell />}
          {settingsTo ? (
            <Link
              to={settingsTo}
              aria-label="Paramètres du compte"
              className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
            >
              <UserRound className="size-3.5" />
              {profile?.full_name?.split(" ")[0]}
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">
              {profile?.full_name?.split(" ")[0]}
            </span>
          )}
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-sidebar p-4">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <BrandLogo size="sm" />
                {hideBrand ? null : <p className="mt-1 text-xs text-muted-foreground">{area}</p>}
              </div>
              <button onClick={() => setOpen(false)} aria-label="Fermer">
                <X className="size-5" />
              </button>
            </div>
            {nav}
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth", replace: true });
              }}
              className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground"
            >
              <LogOut className="size-4" /> Déconnexion
            </button>
          </div>
        </div>
      ) : null}

      <main
        className={cn(
          "w-full max-w-full overflow-x-hidden px-3 py-4 sm:px-4 lg:ml-64 lg:w-auto lg:px-8 lg:py-6",
          bottomItems ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-6" : "",
        )}
      >
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>

      {bottomItems ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <ul className="flex items-stretch">
            {bottomItems.map((item) => {
              const active =
                pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to + "/"));
              return (
                <li key={item.to} className="flex-1">
                  <Link
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <span className="relative [&_svg]:size-5">
                      {item.icon}
                      {item.locked ? (
                        <Lock className="absolute -top-1 -right-2 !size-3 text-muted-foreground" />
                      ) : null}
                    </span>
                    {item.label}
                    {item.badge ? (
                      <span className="absolute top-1 right-1/2 translate-x-4 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {item.badge}
                      </span>
                    ) : null}
                    {active ? (
                      <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
