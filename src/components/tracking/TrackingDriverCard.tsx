import { ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

function initials(full?: string | null) {
  return (full ?? "?").trim().charAt(0).toUpperCase() || "?";
}

/** Carte « Votre chauffeur » : identité, véhicule et accès au profil public. */
export function TrackingDriverCard({
  name,
  avatarUrl,
  vehicleLabel,
  vehiclePhotoUrl,
  slug,
  note,
}: {
  name: string;
  avatarUrl?: string | null;
  vehicleLabel?: string | null;
  vehiclePhotoUrl?: string | null;
  slug?: string | null;
  note?: string | null;
}) {
  return (
    <section className="motion-safe:animate-fade-in rounded-3xl border border-border bg-card p-[clamp(1rem,4vw,1.35rem)]">
      <h2 className="text-sm font-semibold">Votre chauffeur</h2>
      <div className="mt-3 flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            initials(name)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          {vehicleLabel ? (
            <p className="truncate text-xs text-muted-foreground">{vehicleLabel}</p>
          ) : null}
        </div>
        {vehiclePhotoUrl ? (
          <img
            src={vehiclePhotoUrl}
            alt={vehicleLabel ? `Véhicule ${vehicleLabel}` : "Véhicule du chauffeur"}
            loading="lazy"
            draggable={false}
            className="h-14 w-20 shrink-0 cursor-default rounded-xl object-cover"
          />
        ) : null}
      </div>

      {note ? (
        <p className="mt-3 rounded-2xl bg-muted p-3 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          « {note} »
        </p>
      ) : null}

      {slug ? (
        <Link
          to="/chauffeur/$slug"
          params={{ slug }}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-between rounded-2xl border border-border px-4 text-sm font-semibold transition-colors duration-200 hover:bg-muted/50"
        >
          Voir le profil <ChevronRight className="size-4" />
        </Link>
      ) : null}
    </section>
  );
}
