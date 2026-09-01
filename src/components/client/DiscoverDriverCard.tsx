import { Link } from "@tanstack/react-router";
import { ChevronRight, Sparkles } from "lucide-react";
import { WFW_LABEL } from "@/lib/woman-for-woman";
import { cn } from "@/lib/utils";
import { driverAccentVars } from "@/lib/booking-themes";
import type { CSSProperties } from "react";

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
  on_duty: boolean | null;
  woman_for_woman: boolean | null;
  rank_position?: number | null;
};

export function DiscoverDriverCard({
  driver,
  photoUrl,
  theme,
}: {
  driver: DiscoverDriver;
  photoUrl: string | null;
  /** Identité visuelle choisie par le chauffeur (accents uniquement). */
  theme?: string | null;
}) {
  const accents = driverAccentVars(theme) as CSSProperties;
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
              <ChevronRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
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
        {/* Plus de statut manuel : la disponibilité se lit sur la vitrine (horaires). */}
      </div>
    </>
  );

  const className = cn(
    "group block overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-card transition",
    wfw && "wfw-card",
  );

  if (!driver.slug)
    return (
      <div className={className} style={accents}>
        {inner}
      </div>
    );
  return (
    <Link
      to="/chauffeur/$slug"
      params={{ slug: driver.slug }}
      className={cn(className, "tap tap-active")}
      style={accents}
    >
      {inner}
    </Link>
  );
}
