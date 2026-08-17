import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Car, ChevronLeft, ChevronRight, QrCode, UserRound } from "lucide-react";

export type SpotlightDriver = {
  id: string;
  name: string;
  available: boolean;
  vehicle: string | null;
  /** URL signée de la photo extérieure du véhicule déclaré par le chauffeur. */
  vehiclePhotoUrl?: string | null;
  slug: string | null;
  favorite: boolean;
};

/**
 * Bloc média horizontal : photo extérieure du véhicule du chauffeur sélectionné.
 * Ratio stable (aucun saut), placeholder élégant si aucune photo n'est enregistrée.
 */
function VehicleHero({
  url,
  alt,
  loading,
}: {
  url: string | null | undefined;
  alt: string;
  loading: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setFailed(false);
    setReady(false);
  }, [url]);

  const showImage = !!url && !failed;

  return (
    <div className="relative h-[var(--home-hero-h)] w-full overflow-hidden rounded-2xl bg-muted shadow-[0_6px_18px_-16px_rgba(0,0,0,0.5)]">
      {loading ? (
        <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
      ) : showImage ? (
        <>
          {!ready ? <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden /> : null}
          <img
            src={url!}
            alt={alt}
            className={`size-full object-cover object-center transition-opacity duration-200 ${
              ready ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setReady(true)}
            onError={() => setFailed(true)}
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-3 pt-6 pb-1.5 text-[11px] font-semibold text-white">
            Véhicule de votre chauffeur
          </span>
        </>
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
          <Car className="size-7" aria-hidden />
          <p className="text-[11px] font-semibold">Photo du véhicule non disponible</p>
        </div>
      )}
    </div>
  );
}

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
 * Photo du véhicule + carte horizontale du chauffeur sélectionné (un seul élément du carrousel).
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

  // Préchargement des photos précédente et suivante pour éviter tout skeleton au swipe.
  useEffect(() => {
    if (!multiple || typeof window === "undefined") return;
    [index - 1, index + 1].forEach((i) => {
      const url = drivers[(i + drivers.length) % drivers.length]?.vehiclePhotoUrl;
      if (url) {
        const img = new Image();
        img.src = url;
      }
    });
  }, [drivers, index, multiple]);

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
        {/* Photo + informations glissent ensemble : un seul élément du carrousel. */}
        <div
          key={driver?.id ?? (loading ? "loading" : "empty")}
          className={`space-y-[calc(var(--home-gap)*0.75)] ${anim}`}
          style={drag ? { transform: `translate3d(${drag * 0.35}px,0,0)` } : undefined}
        >
          <VehicleHero
            url={driver?.vehiclePhotoUrl}
            alt={driver ? `Véhicule de ${driver.name}` : "Véhicule du chauffeur"}
            loading={loading}
          />

          <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Votre chauffeur sélectionné
          </p>

          <div className="flex min-h-[var(--home-driver-h)] items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-3 py-2 shadow-[0_6px_18px_-16px_rgba(0,0,0,0.5)] sm:gap-3">
            {loading ? (
              <>
                <span className="size-[var(--home-avatar)] shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <span className="block h-3.5 w-1/2 animate-pulse rounded bg-muted" />
                  <span className="block h-3 w-2/3 animate-pulse rounded bg-muted" />
                  <span className="block h-3 w-1/3 animate-pulse rounded bg-muted" />
                </div>
              </>
            ) : driver ? (
              <>
                <span className="grid size-[var(--home-avatar)] shrink-0 place-items-center rounded-full bg-primary/10 text-[14px] font-extrabold text-primary">
                  {initials(driver.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] leading-tight font-extrabold sm:text-[15px]">
                    {driver.name}
                  </p>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] leading-tight font-semibold">
                    <span
                      aria-hidden
                      className={`size-1.5 shrink-0 rounded-full ${
                        driver.available ? "status-dot-pulse bg-primary" : "bg-muted-foreground/50"
                      }`}
                    />
                    <span
                      className={`truncate ${driver.available ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {driver.available ? "Disponible maintenant" : "Indisponible actuellement"}
                    </span>
                  </p>
                  <p className="truncate text-[12px] leading-tight text-muted-foreground">
                    {driver.vehicle ?? "Véhicule non renseigné"}
                  </p>
                </div>
                {driver.slug ? (
                  <Link
                    to="/chauffeur/$slug"
                    params={{ slug: driver.slug }}
                    className="max-w-[5.5rem] shrink-0 self-center text-right text-[12px] leading-tight font-bold text-primary underline underline-offset-2"
                  >
                    Voir le profil
                  </Link>
                ) : (
                  <UserRound className="size-5 shrink-0 text-muted-foreground" />
                )}
              </>
            ) : (
              <>
                <span className="grid size-[var(--home-avatar)] shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <QrCode className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] leading-tight font-extrabold sm:text-[15px]">
                    Aucun chauffeur
                  </p>
                  <p className="text-[12px] leading-tight text-muted-foreground">
                    Scannez le QR code de votre chauffeur pour l'ajouter.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {multiple ? (
        <>
          <button
            type="button"
            aria-label="Chauffeur précédent"
            onClick={() => go(-1)}
            className="absolute top-[calc(var(--home-hero-h)/2-1rem)] left-2 grid size-8 place-items-center rounded-full border border-primary/25 bg-card/90 text-primary shadow-sm backdrop-blur transition-transform active:scale-95"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Chauffeur suivant"
            onClick={() => go(1)}
            className="absolute top-[calc(var(--home-hero-h)/2-1rem)] right-2 grid size-8 place-items-center rounded-full border border-primary/25 bg-card/90 text-primary shadow-sm backdrop-blur transition-transform active:scale-95"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="mt-1 flex items-center justify-center gap-2">
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
            <span className="truncate text-[11px] text-muted-foreground">
              {index + 1} sur {drivers.length} ·{" "}
              <span className="home-carousel-long">Balayez pour changer de chauffeur</span>
              <span className="home-carousel-short">Balayez</span>
            </span>
          </div>
        </>
      ) : null}
    </section>
  );
}
