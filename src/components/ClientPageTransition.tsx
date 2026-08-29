import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useRouterState } from "@tanstack/react-router";

const CLIENT_TAB_ORDER = ["/espace", "/espace/courses", "/espace/chauffeurs", "/espace/parametres"];
const CLIENT_TAB_KEYS = ["home", "courses", "drivers", "profile"];
const TRANSITION_MS = 380;

function makeTabIndex(order: string[]) {
  return (pathname: string): number => {
    const root = order[0]!;
    if (pathname === root || pathname === `${root}/`) return 0;
    for (let i = order.length - 1; i >= 1; i--) {
      if (pathname.startsWith(order[i]!)) return i;
    }
    return -1; // sous-page hors onglets principaux
  };
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
  tabOrder = CLIENT_TAB_ORDER,
  tabKeys = CLIENT_TAB_KEYS,
  bottomOffset = "3.5rem",
}: {
  children: ReactNode;
  onTransitionChange?: (running: boolean) => void;
  /** Ordre réel des onglets principaux (index 0 = premier onglet). */
  tabOrder?: string[];
  /** Clés stables associées aux onglets, même longueur que tabOrder. */
  tabKeys?: string[];
  /** Hauteur de la barre de navigation inférieure (la couche verte s'arrête au-dessus). */
  bottomOffset?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const previous = useRef(pathname);
  const [state, setState] = useState<{ key: string; dir: "right" | "left"; sheet: boolean } | null>(
    null,
  );

  const tabIndex = useMemo(() => makeTabIndex(tabOrder), [tabOrder]);
  const isMainTab = useCallback(
    (p: string) => tabOrder.some((t) => p === t || p === `${t}/`),
    [tabOrder],
  );
  const tabKey = useCallback(
    (p: string) => {
      const i = tabIndex(p);
      return i >= 0 ? (tabKeys[i] ?? p) : p;
    },
    [tabIndex, tabKeys],
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
  }, [isMainTab, onTransitionChange, pathname, tabIndex, tabKey]);

  useEffect(() => {
    if (!state) return;
    const t = window.setTimeout(() => {
      setState((s) => (s?.key === state.key ? null : s));
      onTransitionChange?.(false);
      window.dispatchEvent(new Event("resize"));
    }, TRANSITION_MS);
    return () => window.clearTimeout(t);
  }, [onTransitionChange, state]);

  const anim = state
    ? state.dir === "right"
      ? "client-page-in-right"
      : "client-page-in-left"
    : "";

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
          style={{ bottom: `calc(${bottomOffset} + env(safe-area-inset-bottom))` }}
        />
      ) : null}
    </div>
  );
}
