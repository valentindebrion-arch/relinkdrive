import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, QrCode, UserRound } from "lucide-react";

export type SpotlightDriver = {
  id: string;
  name: string;
  available: boolean;
  vehicle: string | null;
  slug: string | null;
  favorite: boolean;
};

const SWIPE_MIN = 48;
const ANIM_MS = 240;

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
 * Carte horizontale du chauffeur sélectionné + carrousel (swipe, flèches, indicateur).
 * Hauteur constante : aucun saut de mise en page pendant les transitions.
 */
export function DriverSpotlight({
  drivers,
  index,
  onIndexChange,
  loading,
}: {
  drivers: SpotlightDriver[];
  index: number;
  onIndexChange: (next: number) => void;
  loading: boolean;
}) {
  const driver = drivers[index] ?? null;
  const multiple = drivers.length > 1;

  const [dir, setDir] = useState<"right" | "left" | null>(null);
  const [drag, setDrag] = useState(0);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    if (!dir) return;
    const t = window.setTimeout(() => setDir(null), ANIM_MS);
    return () => window.clearTimeout(t);
  }, [dir, index]);

  function go(delta: number) {
    if (!multiple) return;
    setDir(delta > 0 ? "right" : "left");
    setDrag(0);
    haptic();
    onIndexChange((index + delta + drivers.length) % drivers.length);
  }

  const anim = dir === "right" ? "driver-card-in-right" : dir === "left" ? "driver-card-in-left" : "";

  return (
    <section className="relative shrink-0">
      <p className="mb-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
        Votre chauffeur sélectionné
      </p>

      <div
        className="relative overflow-hidden rounded-2xl"
        onTouchStart={(e) => {
          if (!multiple) return;
          startX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchMove={(e) => {
          if (startX.current == null) return;
          const x = e.touches[0]?.clientX;
          if (x == null) return;
          setDrag(Math.max(-64, Math.min(64, x - startX.current)));
        }}
        onTouchEnd={(e) => {
          const start = startX.current;
          startX.current = null;
          const end = e.changedTouches[0]?.clientX;
          setDrag(0);
          if (start == null || end == null) return;
          const dx = end - start;
          if (Math.abs(dx) > SWIPE_MIN) go(dx < 0 ? 1 : -1);
        }}
      >
        <div
          key={driver?.id ?? (loading ? "loading" : "empty")}
          className={`flex h-[5.5rem] items-center gap-3 rounded-2xl border border-border/70 bg-card px-3 shadow-[0_6px_18px_-16px_rgba(0,0,0,0.5)] ${anim}`}
          style={drag ? { transform: `translate3d(${drag * 0.35}px,0,0)` } : undefined}
        >
          {loading ? (
            <>
              <span className="size-14 shrink-0 animate-pulse rounded-2xl bg-muted" />
              <div className="min-w-0 flex-1 space-y-2">
                <span className="block h-3.5 w-1/2 animate-pulse rounded bg-muted" />
                <span className="block h-3 w-2/3 animate-pulse rounded bg-muted" />
                <span className="block h-3 w-1/3 animate-pulse rounded bg-muted" />
              </div>
            </>
          ) : driver ? (
            <>
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-[16px] font-extrabold text-primary">
                {initials(driver.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-extrabold">{driver.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold">
                  <span
                    aria-hidden
                    className={`size-1.5 shrink-0 rounded-full ${
                      driver.available ? "status-dot-pulse bg-primary" : "bg-muted-foreground/50"
                    }`}
                  />
                  <span className={driver.available ? "text-primary" : "text-muted-foreground"}>
                    {driver.available ? "Disponible maintenant" : "Indisponible actuellement"}
                  </span>
                </p>
                <p className="truncate text-[12px] text-muted-foreground">
                  {driver.vehicle ?? "Véhicule non renseigné"}
                </p>
              </div>
              {driver.slug ? (
                <Link
                  to="/chauffeur/$slug"
                  params={{ slug: driver.slug }}
                  className="shrink-0 self-center text-[12px] font-bold text-primary underline underline-offset-2"
                >
                  Voir le profil
                </Link>
              ) : (
                <UserRound className="size-5 shrink-0 text-muted-foreground" />
              )}
            </>
          ) : (
            <>
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <QrCode className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-extrabold">Aucun chauffeur</p>
                <p className="text-[12px] text-muted-foreground">
                  Scannez le QR code de votre chauffeur pour l'ajouter.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {multiple ? (
        <>
          <button
            type="button"
            aria-label="Chauffeur précédent"
            onClick={() => go(-1)}
            className="absolute top-1/2 -left-1 grid size-8 place-items-center rounded-full border border-primary/25 bg-card text-primary shadow-sm transition-transform active:scale-95"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Chauffeur suivant"
            onClick={() => go(1)}
            className="absolute top-1/2 -right-1 grid size-8 place-items-center rounded-full border border-primary/25 bg-card text-primary shadow-sm transition-transform active:scale-95"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="mt-1.5 flex items-center justify-center gap-2">
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
              {index + 1} sur {drivers.length} · Balayez pour changer de chauffeur
            </span>
          </div>
        </>
      ) : null}
    </section>
  );
}
