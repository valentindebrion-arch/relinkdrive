import { Link } from "@tanstack/react-router";
import { ChevronRight, Sparkles } from "lucide-react";
import { WFW_LABEL } from "@/lib/woman-for-woman";
import { cn } from "@/lib/utils";

export type DiscoverDriver = {
  user_id: string;
  slug: string | null;
  display_name: string;
  city: string | null;
  zone: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_category: string | null;
  vehicle_photo_url: string | null;
  max_passengers: number | null;
  rating_avg: number | null;
  rating_count: number;
  on_duty: boolean | null;
  woman_for_woman: boolean | null;
  rank_position?: number | null;
};

export function DiscoverDriverCard({
  driver,
  photoUrl,
  premium,
}: {
  driver: DiscoverDriver;
  photoUrl: string | null;
  /** Carte de la sélection « La crème de la crème ». */
  premium?: boolean;
}) {
  const wfw = !!driver.woman_for_woman;
  const seats = driver.max_passengers;
  const vehicle = [driver.vehicle_brand, driver.vehicle_model].filter(Boolean).join(" ");

  const inner = (
    <>
      <div className="relative aspect-video w-full bg-muted">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`Véhicule de ${driver.display_name}`}
            className="size-full object-cover"
            loading="lazy"
            draggable={false}
          />
        ) : null}
        {premium ? (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-primary/92 px-2.5 py-1 text-[11px] font-extrabold text-primary-foreground shadow-sm backdrop-blur-sm">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Sélection ReLink
          </span>
        ) : null}
        {wfw ? (
          <span className="wfw-badge absolute top-3 right-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold shadow-sm backdrop-blur-sm">
            <Sparkles className="size-3" aria-hidden /> {WFW_LABEL}
          </span>
        ) : null}
      </div>
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-extrabold tracking-tight">{driver.display_name}</span>
          {driver.slug ? (
            <span className="flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-primary">
              Voir le profil
              <ChevronRight
                className="size-4 transition group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          ) : null}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted-foreground">
          {driver.city ? <span>{driver.city}</span> : null}
          {vehicle ? <span>· {vehicle}</span> : null}
          {typeof seats === "number" ? (
            <span>· {seats > 4 ? `Van · ${seats} places` : `Berline · ${seats} places`}</span>
          ) : null}
        </p>
        <p className="mt-1.5 flex items-center gap-2 text-[12px] font-semibold">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
              driver.on_duty
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                driver.on_duty ? "bg-primary" : "bg-muted-foreground/60",
              )}
              aria-hidden
            />
            {driver.on_duty ? "Disponible" : "Indisponible actuellement"}
          </span>
          {driver.rating_count > 0 && driver.rating_avg ? (
            <span className="text-muted-foreground">
              ★ {driver.rating_avg.toFixed(1)} ({driver.rating_count})
            </span>
          ) : null}
        </p>
      </div>
    </>
  );

  const className = cn(
    "group block overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-card transition",
    wfw && "wfw-card",
  );

  if (!driver.slug) return <div className={className}>{inner}</div>;
  return (
    <Link
      to="/chauffeur/$slug"
      params={{ slug: driver.slug }}
      className={cn(className, "tap tap-active")}
    >
      {inner}
    </Link>
  );
}
