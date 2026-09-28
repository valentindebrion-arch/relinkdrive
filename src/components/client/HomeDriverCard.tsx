import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Car, ChevronLeft, ChevronRight, QrCode } from "lucide-react";
import { AvatarPhoto } from "@/components/AvatarPhoto";

export type HomeCardDriver = {
  id: string;
  name: string;
  avatarUrl: string | null;
  vehicle: string | null;
  vehiclePhotoUrl: string | null;
  /** URL signée de la photo de face du véhicule, affichée en priorité sur l'accueil. */
  frontPhotoUrl?: string | null;
  /** Calculé à partir des horaires habituels du chauffeur (aucun statut manuel). */
  available: boolean;
  /** Indication sobre hors horaires (« Disponible à partir de 8h »). */
  availabilityHint?: string | null;
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
          className={`client-home-driver-card overflow-hidden rounded-[2rem] border border-white/80 bg-card ${anim}`}
          style={drag ? { transform: `translate3d(${drag * 0.3}px,0,0)` } : undefined}
        >
          {/* Photo du véhicule */}
          <div className="client-home-vehicle relative aspect-[16/10] w-full bg-muted sm:aspect-[16/9]">
            {loading ? (
              <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
            ) : driver?.frontPhotoUrl ? (
              <>
                {!photoReady ? (
                  <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
                ) : null}
                <img
                  src={driver.frontPhotoUrl ?? undefined}
                  alt={`Véhicule de ${driver.name}`}
                  loading="eager"
                  decoding="async"
                  draggable={false}
                  className="size-full cursor-default object-cover"
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
              <span className="absolute top-3 left-3 rounded-full border border-white/40 bg-black/30 px-3 py-1.5 text-[10px] font-bold tracking-wide text-white uppercase shadow-sm backdrop-blur-md">
                Mon chauffeur
              </span>
            ) : null}

            {driver?.available ? (
              <span className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full border border-white/50 bg-white/90 px-3 py-1.5 text-[11px] font-bold text-primary shadow-sm backdrop-blur">
                <span className="status-dot-pulse size-1.5 rounded-full bg-primary" aria-hidden />
                Disponible
              </span>
            ) : driver?.availabilityHint ? (
              <span className="absolute top-3 right-3 max-w-[52%] truncate rounded-full border border-white/50 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-sm backdrop-blur">
                {driver.availabilityHint}
              </span>
            ) : null}

            {multiple ? (
              <>
                <button
                  type="button"
                  aria-label="Chauffeur précédent"
                  onClick={() => go(-1)}
                  className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/50 bg-white/90 text-foreground shadow-lg backdrop-blur transition hover:scale-105 active:scale-95"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Chauffeur suivant"
                  onClick={() => go(1)}
                  className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/50 bg-white/90 text-foreground shadow-lg backdrop-blur transition hover:scale-105 active:scale-95"
                >
                  <ChevronRight className="size-4" />
                </button>
              </>
            ) : null}
          </div>

          {/* Identité */}
          <div className="client-home-driver-identity flex items-center gap-3 px-4 py-4 sm:px-5">
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
                <AvatarPhoto
                  url={driver.avatarUrl}
                  name={driver.name}
                  className="size-12 shrink-0 rounded-2xl object-cover ring-2 ring-white shadow-md"
                  fallbackClassName="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-[15px] font-extrabold text-primary ring-2 ring-white shadow-md"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] leading-tight font-extrabold">{driver.name}</p>
                  <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                    {driver.vehicle ?? "Véhicule non renseigné"}
                  </p>
                </div>
                {driver.slug ? (
                  <Link
                    to="/chauffeur/$slug"
                    params={{ slug: driver.slug }}
                    className="shrink-0 rounded-xl bg-primary/10 px-3 py-2 text-[12px] font-bold text-primary transition hover:bg-primary/15"
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
