import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Car, ChevronLeft, ChevronRight, QrCode, Star } from "lucide-react";

export type HomeCardDriver = {
  id: string;
  name: string;
  avatarUrl: string | null;
  vehicle: string | null;
  vehiclePhotoUrl: string | null;
  ratingAvg: number | null;
  ratingCount: number;
  trips: number;
  available: boolean;
  slug: string | null;
};

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(8);
    } catch {
      /* non supporté */
    }
  }
}

/**
 * Grande carte chauffeur de l'accueil : photo du véhicule, identité, note,
 * trajets effectués et disponibilité. Un seul chauffeur à la fois, navigable
 * par flèches ou par balayage horizontal.
 */
export function HomeDriverCard({
  drivers,
  index,
  onGo,
  dir,
  loading,
}: {
  drivers: HomeCardDriver[];
  index: number;
  onGo: (delta: number) => void;
  dir: "left" | "right" | null;
  loading: boolean;
}) {
  const driver = drivers[index] ?? null;
  const multiple = drivers.length > 1;
  const startX = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);
  const [photoReady, setPhotoReady] = useState(false);

  const anim =
    dir === "right" ? "driver-card-in-right" : dir === "left" ? "driver-card-in-left" : "";

  function go(delta: number) {
    if (!multiple) return;
    haptic();
    onGo(delta);
  }

  return (
    <section className="relative">
      <div
        className="relative"
        onTouchStart={(e) => {
          if (!multiple) return;
          startX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchMove={(e) => {
          if (startX.current == null) return;
          const x = e.touches[0]?.clientX;
          if (x == null) return;
          setDrag(Math.max(-56, Math.min(56, x - startX.current)));
        }}
        onTouchEnd={(e) => {
          const start = startX.current;
          startX.current = null;
          const end = e.changedTouches[0]?.clientX;
          setDrag(0);
          if (start == null || end == null) return;
          const dx = end - start;
          if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1);
        }}
      >
        <div
          key={driver?.id ?? (loading ? "loading" : "empty")}
          className={`overflow-hidden rounded-[1.75rem] border border-border/60 bg-card shadow-[0_10px_30px_-24px_rgba(0,0,0,0.55)] ${anim}`}
          style={drag ? { transform: `translate3d(${drag * 0.3}px,0,0)` } : undefined}
        >
          {/* Photo du véhicule */}
          <div className="relative aspect-[16/10] w-full bg-muted">
            {loading ? (
              <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
            ) : driver?.vehiclePhotoUrl ? (
              <>
                {!photoReady ? (
                  <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
                ) : null}
                <img
                  src={driver.vehiclePhotoUrl}
                  alt={`Véhicule de ${driver.name}`}
                  loading="eager"
                  decoding="async"
                  className="size-full object-cover"
                  onLoad={() => setPhotoReady(true)}
                />
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                <Car className="size-7" aria-hidden />
                <p className="text-[11px] font-semibold">Photo du véhicule à venir</p>
              </div>
            )}

            {driver ? (
              <span className="absolute top-3 left-3 rounded-full bg-card/95 px-2.5 py-1 text-[11px] font-bold text-primary shadow-sm backdrop-blur">
                Dans vos chauffeurs
              </span>
            ) : null}

            {driver?.available ? (
              <span className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-card/95 px-2.5 py-1 text-[11px] font-bold text-primary shadow-sm backdrop-blur">
                <span className="status-dot-pulse size-1.5 rounded-full bg-primary" aria-hidden />
                Disponible
              </span>
            ) : null}

            {multiple ? (
              <>
                <button
                  type="button"
                  aria-label="Chauffeur précédent"
                  onClick={() => go(-1)}
                  className="absolute top-1/2 left-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-card/90 text-foreground shadow-sm backdrop-blur transition active:scale-95"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Chauffeur suivant"
                  onClick={() => go(1)}
                  className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-card/90 text-foreground shadow-sm backdrop-blur transition active:scale-95"
                >
                  <ChevronRight className="size-4" />
                </button>
              </>
            ) : null}
          </div>

          {/* Identité */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            {loading ? (
              <>
                <span className="size-12 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <span className="block h-4 w-1/2 animate-pulse rounded bg-muted" />
                  <span className="block h-3 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              </>
            ) : driver ? (
              <>
                {driver.avatarUrl ? (
                  <img
                    src={driver.avatarUrl}
                    alt=""
                    className="size-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-[15px] font-extrabold text-primary">
                    {initials(driver.name)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] leading-tight font-extrabold">{driver.name}</p>
                  <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                    {driver.vehicle ?? "Véhicule non renseigné"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold">
                    {driver.ratingAvg ? (
                      <span className="inline-flex items-center gap-1 text-foreground">
                        <Star className="size-3.5 fill-primary text-primary" aria-hidden />
                        {driver.ratingAvg.toFixed(1)}
                        <span className="text-muted-foreground">({driver.ratingCount})</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Pas encore d'avis</span>
                    )}
                    {driver.trips > 0 ? (
                      <span className="text-muted-foreground">
                        {driver.trips} trajet{driver.trips > 1 ? "s" : ""} ensemble
                      </span>
                    ) : null}
                  </div>
                </div>
                {driver.slug ? (
                  <Link
                    to="/chauffeur/$slug"
                    params={{ slug: driver.slug }}
                    className="shrink-0 text-[12px] font-bold text-primary underline underline-offset-2"
                  >
                    Profil
                  </Link>
                ) : null}
              </>
            ) : (
              <>
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <QrCode className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] leading-tight font-extrabold">Aucun chauffeur</p>
                  <p className="text-[13px] text-muted-foreground">
                    Scannez le QR code de votre chauffeur pour l'ajouter.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {multiple ? (
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="flex items-center gap-1">
            {drivers.map((d, i) => (
              <span
                key={d.id}
                className={`size-1.5 rounded-full transition-colors ${
                  i === index ? "bg-primary" : "bg-primary/25"
                }`}
              />
            ))}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {index + 1} sur {drivers.length} · Balayez pour changer
          </span>
        </div>
      ) : null}
    </section>
  );
}
