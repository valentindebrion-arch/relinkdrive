import { usePageVisible } from "@/hooks/use-page-visible";

const LINES = [
  { d: "M-20 120 C 90 60, 210 190, 340 96", dur: 13, delay: 0 },
  { d: "M-20 260 C 120 230, 190 320, 340 250", dur: 16, delay: 3.5 },
  { d: "M-20 420 C 110 380, 220 470, 340 400", dur: 11, delay: 1.5 },
  { d: "M40 -20 C 80 140, 250 300, 300 620", dur: 15, delay: 6 },
] as const;

// Seuls quelques points circulent, pour rester quasi imperceptibles.
const DOTS = [0, 1, 3] as const;

/**
 * Décor d'arrière-plan symbolisant la liaison directe entre le client et son chauffeur.
 * Purement décoratif : jamais interactif, toujours derrière le contenu.
 */
export function ConnectionDecor() {
  const visible = usePageVisible();

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ contain: "paint" }}
    >
      <svg
        viewBox="0 0 320 600"
        preserveAspectRatio="none"
        className="h-full w-full text-primary"
      >
        {LINES.map((l) => (
          <path
            key={l.d}
            d={l.d}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.09"
          />
        ))}
      </svg>
      {DOTS.map((i) => {
        const line = LINES[i]!;
        return (
          <span
            key={i}
            className="decor-dot absolute top-0 left-0 size-1 rounded-full bg-primary/40"
            style={{
              offsetPath: `path("${line.d}")`,
              animationDuration: `${line.dur}s`,
              animationDelay: `${line.delay}s`,
              animationPlayState: visible ? "running" : "paused",
            }}
          />
        );
      })}
    </div>
  );
}
