import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

const SESSION_KEY = "relink:splash-played";
const FULL_MS = 1600;
const REDUCED_MS = 420;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Écran d'ouverture de l'espace client : couches verte/blanche cohérentes avec
 * les transitions d'onglets, logo ReLink centré, joué une seule fois par lancement.
 */
export function ClientSplash({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let played = true;
    try {
      played = window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      played = false;
    }

    const isReduced = prefersReducedMotion();
    const duration = isReduced ? REDUCED_MS : FULL_MS;

    if (played) {
      // Déjà joué (ou remontage en développement) : on referme immédiatement.
      setVisible(false);
      onDone?.();
      return;
    }

    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* stockage indisponible */
    }

    setReduced(isReduced);
    setVisible(true);

    const slowTimer = window.setTimeout(() => setSlow(true), duration + 600);
    const endTimer = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
      window.dispatchEvent(new Event("resize"));
    }, duration);
    // Filet de sécurité : le splash ne doit jamais rester bloqué à l'écran.
    const failsafe = window.setTimeout(() => setVisible(false), duration + 2500);

    return () => {
      window.clearTimeout(endTimer);
      window.clearTimeout(slowTimer);
      window.clearTimeout(failsafe);
    };
  }, [onDone]);


  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[120] overflow-hidden bg-background"
      style={{ pointerEvents: "none" }}
    >
      {!reduced ? (
        <>
          <div className="splash-sheet-green absolute inset-0 bg-primary" />
          <div className="splash-sheet-white absolute inset-0 bg-background" />
        </>
      ) : null}

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <div className={reduced ? "splash-logo-reduced" : "splash-logo relative"}>
          {!reduced ? (
            <span className="splash-ring pointer-events-none absolute -inset-6 rounded-full border-2 border-primary/40" />
          ) : null}
          <BrandLogo size="lg" />
        </div>
        {slow ? (
          <p className="rise-in text-sm text-muted-foreground">Chargement de votre espace…</p>
        ) : null}
      </div>
    </div>
  );
}
