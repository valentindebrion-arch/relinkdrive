import { useEffect } from "react";
import { Car, Check } from "lucide-react";

type Props = {
  firstName: string;
  name: string;
  vehicleLabel?: string | null;
  photoUrl?: string | null;
  onDone: () => void;
};

/**
 * Miroir « inverse » de l'animation d'ajout : le chauffeur quitte le réseau.
 * Identité rouge, mouvement de recul, disparition propre (~1,8 s).
 */
export function DriverRemovedOverlay({
  firstName,
  name,
  vehicleLabel,
  photoUrl,
  onDone,
}: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 1800);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="removal-overlay fixed inset-0 z-[80] flex items-center justify-center bg-background/80 px-6 backdrop-blur-md"
    >
      <div className="w-full max-w-[19rem]">
        <div className="removal-card overflow-hidden rounded-[1.35rem] border border-destructive/45 bg-card">
          <div className="relative aspect-video w-full bg-muted">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                className="removal-photo size-full cursor-default object-cover"
                draggable={false}
              />
            ) : (
              <span className="grid size-full place-items-center text-muted-foreground">
                <Car className="size-8" aria-hidden />
              </span>
            )}
            <span className="removal-tint pointer-events-none absolute inset-0 bg-destructive/25" />
            <span className="removal-check absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-lg">
              <Check className="size-4" strokeWidth={3} />
            </span>
          </div>
          <div className="px-4 py-3">
            <p className="truncate text-[15px] leading-tight font-extrabold">{name}</p>
            <p className="mt-0.5 truncate text-[13px] font-semibold text-muted-foreground">
              {vehicleLabel || "Chauffeur retiré"}
            </p>
          </div>
        </div>

        <div className="removal-caption mt-4 text-center">
          <p className="text-[15px] font-black tracking-tight text-destructive">Chauffeur retiré</p>
          <p className="mt-1 text-[13px] font-semibold text-muted-foreground">
            {firstName} a été retiré de vos chauffeurs
          </p>
        </div>
      </div>
    </div>
  );
}
