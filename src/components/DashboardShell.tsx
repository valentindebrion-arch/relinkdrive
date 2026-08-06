import { useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Menu, LogOut, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export type NavItem = { to: string; label: string; icon: ReactNode };

export function DashboardShell({
  items,
  area,
  children,
  dense = false,
}: {
  items: NavItem[];
  area: string;
  children: ReactNode;
  dense?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to + "/"));
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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <Link to="/" className="mb-6 block">
          <p className="text-lg font-semibold tracking-tight">{BRAND.name}</p>
          <p className="text-xs text-muted-foreground">{area}</p>
        </Link>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/auth", replace: true });
          }}
          className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          <LogOut className="size-4" /> Déconnexion
        </button>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
          <Menu className="size-5" />
        </button>
        <p className="font-semibold">{BRAND.name}</p>
        <span className="text-xs text-muted-foreground">{profile?.full_name?.split(" ")[0]}</span>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-sidebar p-4">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">{BRAND.name}</p>
                <p className="text-xs text-muted-foreground">{area}</p>
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

      <main className="px-4 py-6 lg:ml-64 lg:px-8">{children}</main>
    </div>
  );
}
