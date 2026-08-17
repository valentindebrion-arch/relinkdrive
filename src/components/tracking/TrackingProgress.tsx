import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRACKING_STEPS, type TrackingStepKey } from "@/lib/tracking-status";

function timeLabel(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Progression verticale compacte.
 * L'avancée n'est jamais simulée : elle dépend uniquement de l'index transmis,
 * lui-même calculé depuis le statut réel enregistré par le chauffeur.
 */
export function TrackingProgress({
  current,
  times,
}: {
  current: number;
  times?: Partial<Record<TrackingStepKey, string | null>>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fill, setFill] = useState(0);
  const previous = useRef<number | null>(null);

  // La ligne ne s'anime que lors d'un véritable changement d'étape.
  useEffect(() => {
    const target = TRACKING_STEPS.length > 1 ? (current / (TRACKING_STEPS.length - 1)) * 100 : 0;
    if (previous.current === current) return;
    previous.current = current;
    const id = requestAnimationFrame(() => setFill(Math.max(0, Math.min(100, target))));
    return () => cancelAnimationFrame(id);
  }, [current]);

  const visible = TRACKING_STEPS.map((step, i) => ({ step, i })).filter(({ i }) => {
    if (expanded) return true;
    // Réduit : on garde l'étape active, la précédente et la suivante.
    return Math.abs(i - current) <= 1;
  });

  return (
    <section className="motion-safe:animate-fade-in rounded-3xl border border-border bg-card p-[clamp(1rem,4vw,1.35rem)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Progression</h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          Étape {Math.min(current + 1, TRACKING_STEPS.length)} sur {TRACKING_STEPS.length}
        </p>
      </div>

      <ol className="relative mt-4">
        {/* Rail complet + rail vert animé, uniquement en mode déployé. */}
        {expanded ? (
          <>
            <span aria-hidden className="absolute top-3 bottom-3 left-[13px] w-px bg-border" />
            <span
              aria-hidden
              className="absolute top-3 left-[13px] w-px bg-primary motion-reduce:transition-none"
              style={{
                height: `calc((100% - 1.5rem) * ${fill / 100})`,
                transition: "height 450ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </>
        ) : null}

        {visible.map(({ step, i }, position) => {
          const done = current > i;
          const active = current === i;
          const last = position === visible.length - 1;
          return (
            <li key={step.key} className="relative flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className={cn(
                    "relative z-10 grid size-7 shrink-0 place-items-center rounded-full border-2 bg-card text-[11px] font-bold",
                    "transition-[background-color,border-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : active
                        ? "border-primary text-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary)_12%,transparent)]"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                {!last ? (
                  <span
                    aria-hidden
                    className={cn("my-1 w-px flex-1", done ? "bg-primary" : "bg-border")}
                  />
                ) : null}
              </div>

              <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-4")}>
                <div
                  className={cn(
                    "min-w-0",
                    active
                      ? "motion-safe:animate-fade-in rounded-2xl border border-primary/20 bg-primary/[0.05] px-3 py-2"
                      : "",
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p
                      className={cn(
                        "text-sm [overflow-wrap:anywhere]",
                        active ? "font-bold" : done ? "font-medium" : "text-muted-foreground",
                      )}
                    >
                      {step.title}
                    </p>
                    {timeLabel(times?.[step.key]) ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {timeLabel(times?.[step.key])}
                      </span>
                    ) : null}
                  </div>
                  {active ? (
                    <>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                        {step.hint}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold tracking-wide text-primary uppercase">
                        Étape actuelle
                      </p>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-border text-sm font-semibold transition-colors duration-200 hover:bg-muted/50"
      >
        {expanded ? "Réduire les étapes" : "Voir toutes les étapes"}
        <ChevronDown
          className={cn("size-4 transition-transform duration-200", expanded ? "rotate-180" : "")}
        />
      </button>
    </section>
  );
}
