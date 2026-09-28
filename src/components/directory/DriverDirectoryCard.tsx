import { Link } from "@tanstack/react-router";
import { MapPin, Users, Car, Sparkles } from "lucide-react";
import { serviceLabel, categoryLabel } from "@/lib/showcase";
import { AvatarPhoto } from "@/components/AvatarPhoto";
import { cn } from "@/lib/utils";
import { driverAccentVars } from "@/lib/booking-themes";
import type { CSSProperties } from "react";

export type DirectoryDriver = {
  user_id: string;
  slug: string | null;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  zone: string | null;
  public_intro: string | null;
  services: string[] | null;
  languages: string[] | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_category: string | null;
  vehicle_photo_url: string | null;
  max_passengers: number | null;
  woman_for_woman: boolean | null;
};

export function DriverDirectoryCard({
  driver,
  theme,
}: {
  driver: DirectoryDriver;
  /** Identité visuelle choisie par le chauffeur (accents uniquement). */
  theme?: string | null;
}) {
  const services = (driver.services ?? []).slice(0, 3);
  const vehicle = [driver.vehicle_brand, driver.vehicle_model].filter(Boolean).join(" ");
  const category = categoryLabel(driver.vehicle_category);

  return (
    <Link
      to="/chauffeur/$slug"
      params={{ slug: driver.slug ?? "" }}
      style={driverAccentVars(theme) as CSSProperties}
      className={cn(
        "directory-driver-card group flex min-w-0 flex-col overflow-hidden rounded-[1.6rem] border border-emerald-950/8 bg-white shadow-[0_18px_45px_-35px_rgba(9,62,42,.55)]",
        driver.woman_for_woman ? "border-[var(--wfw-border,var(--border))]" : "",
      )}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        {driver.vehicle_photo_url ? (
          <img
            src={driver.vehicle_photo_url}
            alt={vehicle ? `Véhicule ${vehicle}` : "Véhicule du chauffeur"}
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <Car className="size-6" />
            <span className="text-[11px]">Photo non renseignée</span>
          </div>
        )}
        {driver.woman_for_woman ? (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">
            <Sparkles className="size-3" /> Woman for Woman
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-5">
        <div className="flex min-w-0 items-center gap-3">
          <AvatarPhoto
            url={driver.avatar_url}
            name={driver.display_name ?? "Chauffeur"}
            className="size-11 shrink-0 rounded-2xl object-cover ring-2 ring-white shadow-md"
            fallbackClassName="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-sm font-semibold text-accent-foreground ring-2 ring-white shadow-md"
          />
          <p className="min-w-0 truncate text-base font-semibold tracking-[-.02em]">
            {driver.display_name ?? "Chauffeur"}
          </p>
        </div>

        {driver.city || driver.zone ? (
          <p className="inline-flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{driver.zone || driver.city}</span>
          </p>
        ) : null}

        {driver.public_intro ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{driver.public_intro}</p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {category ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
              {category}
            </span>
          ) : null}
          {driver.max_passengers ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
              <Users className="size-3" /> {driver.max_passengers}
            </span>
          ) : null}
          {services.map((s) => (
            <span
              key={s}
              className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground"
            >
              {serviceLabel(s)}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
