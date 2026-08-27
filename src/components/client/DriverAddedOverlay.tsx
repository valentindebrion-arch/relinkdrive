import { useEffect } from "react";
import { Car, Check } from "lucide-react";

type Props = {
  firstName: string;
  name: string;
  vehicleLabel?: string | null;
  photoUrl?: string | null;
  /** Tout premier chauffeur du carnet : variante légèrement plus marquante. */
  first?: boolean;
  onDone: () => void;
};

/**
 * Moment « achievement » après l'ajout d'un chauffeur au carnet.
 * La carte se détache de la page, se soulève, puis part rejoindre
 * l'espace « Mes chauffeurs » (la navigation est déclenchée par onDone).
 */
export function DriverAddedOverlay({
  firstName,
  name,
  vehicleLabel,
  photoUrl,
  first = false,
  onDone,
}: Props) {
  const duration = first ? 2300 : 1750;

  useEffect(() => {
    const t = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(t);
  }, [duration, onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="achievement-overlay fixed inset-0 z-[80] flex items-center justify-center bg-background/80 px-6 backdrop-blur-md"
    >
      <div className="achievement-stage w-full max-w-[19rem]">
        <div className="achievement-card overflow-hidden rounded-[1.35rem] border border-border bg-card">
          <div className="relative aspect-video w-full bg-muted">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                className="size-full cursor-default object-cover"
                draggable={false}
              />
            ) : (
              <span className="grid size-full place-items-center text-muted-foreground">
                <Car className="size-8" aria-hidden />
              </span>
            )}
            <span className="achievement-check absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Check className="size-4" strokeWidth={3} />
            </span>
          </div>
          <div className="px-4 py-3">
            <p className="truncate text-[15px] leading-tight font-extrabold">{name}</p>
            <p className="mt-0.5 truncate text-[13px] font-semibold text-muted-foreground">
              {vehicleLabel || "Chauffeur de confiance"}
            </p>
          </div>
        </div>

        <div className="achievement-caption mt-4 text-center">
          <p className="text-[15px] font-black tracking-tight text-primary">
            {first ? "Votre réseau commence ici" : "+1 chauffeur de confiance"}
          </p>
          <p className="mt-1 text-[13px] font-semibold text-muted-foreground">
            {first
              ? `${firstName} est votre premier chauffeur Relink`
              : `${firstName} rejoint vos chauffeurs`}
          </p>
        </div>
      </div>
    </div>
  );
}
