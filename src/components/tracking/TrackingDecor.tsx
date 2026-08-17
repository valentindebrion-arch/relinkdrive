/**
 * Décor d'arrière-plan très discret pour la page de suivi.
 * Purement décoratif : jamais interactif, toujours derrière les cartes,
 * et sans aucun débordement horizontal possible.
 */
export function TrackingDecor() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden"
      style={{ contain: "paint" }}
    >
      <div className="absolute -top-24 left-1/2 h-64 w-[140%] -translate-x-1/2 rounded-[50%] bg-primary/[0.06] blur-2xl" />
      <svg viewBox="0 0 320 420" preserveAspectRatio="none" className="h-full w-full text-primary">
        <path
          d="M-10 90 C 90 40, 220 150, 340 80"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.10"
        />
        <path
          d="M-10 240 C 110 200, 200 300, 340 230"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.07"
        />
        <circle cx="58" cy="70" r="2" fill="currentColor" opacity="0.16" />
        <circle cx="252" cy="118" r="2" fill="currentColor" opacity="0.13" />
        <circle cx="150" cy="264" r="2" fill="currentColor" opacity="0.10" />
      </svg>
    </div>
  );
}
