import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrackingTone } from "@/lib/tracking-status";

const TONES: Record<TrackingTone, string> = {
  neutral: "border-border bg-card",
  progress: "border-primary/25 bg-primary/[0.05]",
  success: "border-success/25 bg-success/[0.06]",
  stopped: "border-destructive/25 bg-destructive/[0.05]",
};

const ICON_TONES: Record<TrackingTone, string> = {
  neutral: "bg-muted text-foreground",
  progress: "bg-primary/12 text-primary",
  success: "bg-success/15 text-success",
  stopped: "bg-destructive/10 text-destructive",
};

/**
 * Unique source visuelle prioritaire du statut : le statut n'est répété
 * nulle part ailleurs sous la même forme.
 */
export function StatusHeroCard({
  icon: Icon,
  tone,
  title,
  description,
  next,
  updatedAt,
  children,
}: {
  icon: LucideIcon;
  tone: TrackingTone;
  title: string;
  description: string;
  next?: string | null;
  updatedAt?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <section
      aria-live="polite"
      className={cn(
        "motion-safe:animate-fade-in relative overflow-hidden rounded-3xl border p-[clamp(1rem,4vw,1.35rem)] shadow-[0_1px_10px_rgba(0,0,0,0.04)]",
        TONES[tone],
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", ICON_TONES[tone])}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[clamp(1.05rem,4.6vw,1.3rem)] leading-tight font-extrabold tracking-tight [overflow-wrap:anywhere]">
            {title}
          </h1>
          <p className="mt-1 text-sm leading-snug text-muted-foreground [overflow-wrap:anywhere]">
            {description}
          </p>
        </div>
      </div>

      {next ? (
        <p className="mt-3 rounded-2xl bg-background/70 px-3 py-2 text-[13px] leading-snug font-medium [overflow-wrap:anywhere]">
          <span className="text-muted-foreground">Prochaine étape : </span>
          {next}
        </p>
      ) : null}

      {children}

      {updatedAt ? (
        <p className="mt-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Mis à jour à {updatedAt}
        </p>
      ) : null}
    </section>
  );
}
