import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Car, CircleUserRound, HelpCircle, Menu, Settings, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";

const MENU = [
  { to: "/espace/courses", label: "Mes trajets", icon: Car },
  { to: "/espace/parametres", label: "Mon profil", icon: CircleUserRound },
  { to: "/espace/parametres", label: "Paramètres", icon: Settings },
  { to: "/aide", label: "Aide", icon: HelpCircle },
] as const;

/**
 * Barre supérieure de l'espace client : logo ReLink et menu discret regroupant
 * toutes les fonctions secondaires (trajets, profil, paramètres, aide).
 */
export function ClientTopBar({ title, className }: { title?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    // Scroll et interactions de l'arrière-plan bloqués tant que le menu est ouvert.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const panel = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 flex touch-none justify-end overscroll-contain bg-foreground/25 backdrop-blur-[2px]"
      style={{ zIndex: 9998 }}
    >
      <button
        type="button"
        aria-label="Fermer le menu"
        className="absolute inset-0 cursor-default"
        onClick={() => setOpen(false)}
      />
      <nav
        className="relative m-3 h-fit w-64 rounded-3xl border border-border/70 bg-card p-3 shadow-xl"
        style={{ marginTop: "calc(env(safe-area-inset-top) + 0.75rem)", zIndex: 9999 }}
      >
        <div className="flex items-center justify-between px-1 pb-2">
          <p className="text-sm font-bold">Menu</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
            className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <ul className="space-y-1">
          {MENU.map((item) => (
            <li key={item.label}>
              <Link
                to={item.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition hover:bg-muted"
              >
                <item.icon className="size-4 text-primary" aria-hidden />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );

  return (
    <>
      <header className={cn("flex items-center justify-between gap-2 py-1.5", className)}>
        <BrandLogo to="/espace" size="sm" />
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="grid size-10 place-items-center rounded-full bg-muted/70 text-foreground transition active:scale-95"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      {title ? <h1 className="text-[22px] leading-tight font-black tracking-tight">{title}</h1> : null}

      {open && mounted ? createPortal(panel, document.body) : null}
    </>
  );
}
