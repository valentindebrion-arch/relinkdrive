import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

const TAB_ORDER = ["/espace", "/espace/courses", "/espace/chauffeurs", "/espace/parametres"];
const TAB_KEYS = ["home", "courses", "drivers", "profile"] as const;
const TRANSITION_MS = 380;

function tabIndex(pathname: string): number {
  if (pathname === "/espace" || pathname === "/espace/") return 0;
  for (let i = TAB_ORDER.length - 1; i >= 1; i--) {
    if (pathname.startsWith(TAB_ORDER[i]!)) return i;
  }
  return -1; // sous-page hors onglets principaux
}

function isMainTab(pathname: string) {
  return TAB_ORDER.some((t) => pathname === t || pathname === `${t}/`);
}

function tabKey(pathname: string) {
  const index = tabIndex(pathname);
  return index >= 0 ? TAB_KEYS[index] : pathname;
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Transition de chevauchement entre les pages de l'espace client.
 * - Onglets principaux : accent vert glissant + nouvelle page en chevauchement.
 * - Sous-pages : glissement discret (droite à l'ouverture, gauche au retour).
 * Le contenu seul est animé : la barre d'onglets reste fixe.
 */
export function ClientPageTransition({
  children,
  onTransitionChange,
}: {
  children: ReactNode;
  onTransitionChange?: (running: boolean) => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const previous = useRef(pathname);
  const [state, setState] = useState<{ key: string; dir: "right" | "left"; sheet: boolean } | null>(
    null,
  );

  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    if (from === pathname) return;
    if (prefersReducedMotion()) {
      setState(null);
      onTransitionChange?.(false);
      return;
    }

    const fromIdx = tabIndex(from);
    const toIdx = tabIndex(pathname);
    const tabSwitch = isMainTab(from) && isMainTab(pathname) && fromIdx !== toIdx;

    let dir: "right" | "left";
    if (tabSwitch) {
      dir = toIdx > fromIdx ? "right" : "left";
    } else {
      // sous-page : ouverture depuis la droite, retour vers la gauche
      dir = pathname.length >= from.length ? "right" : "left";
    }

    setState({ key: tabSwitch ? tabKey(pathname) : pathname, dir, sheet: tabSwitch });
    onTransitionChange?.(true);
  }, [onTransitionChange, pathname]);

  useEffect(() => {
    if (!state) return;
    const t = window.setTimeout(() => {
      setState((s) => (s?.key === state.key ? null : s));
      onTransitionChange?.(false);
      window.dispatchEvent(new Event("resize"));
    }, TRANSITION_MS);
    return () => window.clearTimeout(t);
  }, [onTransitionChange, state]);

  const anim = state ? (state.dir === "right" ? "client-page-in-right" : "client-page-in-left") : "";

  return (
    <div
      className={`relative isolate min-h-[100dvh] overflow-x-hidden ${state ? "pointer-events-none" : ""}`}
      data-client-transition={state ? "running" : "idle"}
    >
      <div key={state?.key ?? tabKey(pathname)} className={anim}>
        {children}
      </div>
      {state?.sheet ? (
        <div
          aria-hidden
          className={`pointer-events-none fixed inset-x-0 top-0 z-30 bg-primary/90 ${
            state.dir === "right" ? "client-sheet-right" : "client-sheet-left"
          }`}
          style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
        />
      ) : null}
    </div>
  );
}
