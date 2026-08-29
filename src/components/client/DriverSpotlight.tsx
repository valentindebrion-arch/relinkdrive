import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Car, ChevronLeft, ChevronRight, QrCode, UserRound } from "lucide-react";

export type SpotlightDriver = {
  id: string;
  name: string;
  available: boolean;
  vehicle: string | null;
  /** URL signée de la photo extérieure du véhicule déclaré par le chauffeur. */
  vehiclePhotoUrl?: string | null;
  /** URL signée de la photo intérieure (préchargée avec l'extérieure). */
  vehicleInteriorUrl?: string | null;
  activeVehicleId?: string | null;
  vehiclePhotoPath?: string | null;
  vehiclePhotoVersion?: string | null;
  slug: string | null;
  favorite: boolean;
};

/**
 * Bloc média horizontal : photo extérieure du véhicule du chauffeur sélectionné.
 * Ratio stable (aucun saut), placeholder élégant si aucune photo n'est enregistrée.
 */
function VehicleHero({
  imageKey,
  url,
  alt,
  loading,
  onRefresh,
}: {
  imageKey: string;
  url: string | null | undefined;
  alt: string;
  loading: boolean;
  onRefresh?: () => Promise<unknown>;
}) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const refreshAttempt = useRef<string | null>(null);

  const syncReadyState = useCallback((image: HTMLImageElement | null) => {
    imageRef.current = image;
    if (image?.complete && image.naturalWidth > 0) {
      setReady(true);
      setFailed(false);
    }
  }, []);

  useLayoutEffect(() => {
    setFailed(false);
    setRefreshing(false);
    setReady(false);
    syncReadyState(imageRef.current);
  }, [imageKey, syncReadyState, url]);

  useEffect(() => {
    const restoreIfCached = () => syncReadyState(imageRef.current);
    restoreIfCached();
    document.addEventListener("visibilitychange", restoreIfCached);
    window.addEventListener("pageshow", restoreIfCached);
    return () => {
      document.removeEventListener("visibilitychange", restoreIfCached);
      window.removeEventListener("pageshow", restoreIfCached);
    };
  }, [imageKey, syncReadyState, url]);

  const showImage = !!url && (!failed || refreshing);

  return (
    <div className="vehicle-media bg-muted shadow-[0_6px_18px_-16px_rgba(0,0,0,0.5)]">
      {loading && !ready ? (
        <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
      ) : showImage ? (
        <>
          {!ready ? <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden /> : null}
          <img
            key={imageKey}
            ref={syncReadyState}
            src={url}
            alt={alt}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            draggable={false}
            className="cursor-default opacity-100"
            onLoad={() => setReady(true)}
            onError={() => {
              if (onRefresh && refreshAttempt.current !== imageKey) {
                refreshAttempt.current = imageKey;
                setRefreshing(true);
                void onRefresh().finally(() => setRefreshing(false));
                return;
              }
              setFailed(true);
            }}
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-3 pt-6 pb-1.5 text-[11px] font-semibold text-white">
            Véhicule de votre chauffeur
          </span>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
          <Car className="size-7" aria-hidden />
          <p className="text-[11px] font-semibold">Photo du véhicule non disponible</p>
        </div>
      )}
    </div>
  );
}

const SWIPE_MIN = 48;
export const ANIM_MS = 260;

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
  onGo,
  dir,
  loading,
  onPhotoRefresh,
}: {
  drivers: SpotlightDriver[];
  index: number;
  /** Le parent pilote le changement : photo, identité et véhicule glissent ensemble. */
  onGo: (delta: number) => void;
  dir: "left" | "right" | null;
  loading: boolean;
  onPhotoRefresh?: () => Promise<unknown>;
}) {
  const driver = drivers[index] ?? null;
  const imageKey = driver
    ? [
        driver.id,
        driver.activeVehicleId ?? "vehicle",
        driver.vehiclePhotoPath ?? "no-photo",
        driver.vehiclePhotoVersion ?? "version",
      ].join(":")
    : "no-driver";
  const multiple = drivers.length > 1;

  const [drag, setDrag] = useState(0);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    setDrag(0);
    startX.current = null;
  }, [imageKey]);

  // Préchargement des photos précédente et suivante pour éviter tout skeleton au swipe.
  useEffect(() => {
    if (!multiple || typeof window === "undefined") return;
    [index - 1, index + 1].forEach((i) => {
      const neighbour = drivers[(i + drivers.length) % drivers.length];
      [neighbour?.vehiclePhotoUrl, neighbour?.vehicleInteriorUrl].forEach((url) => {
        if (!url) return;
        const img = new Image();
        img.src = url;
      });
    });
  }, [drivers, index, multiple]);

  function go(delta: number) {
    if (!multiple) return;
    setDrag(0);
    haptic();
    onGo(delta);
  }

  const anim =
    dir === "right" ? "driver-card-in-right" : dir === "left" ? "driver-card-in-left" : "";

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
          <div className="relative">
            <VehicleHero
              imageKey={imageKey}
              url={driver?.vehiclePhotoUrl}
              alt={driver ? `Véhicule de ${driver.name}` : "Véhicule du chauffeur"}
              loading={loading}
              {...(onPhotoRefresh ? { onRefresh: onPhotoRefresh } : {})}
            />
            {multiple ? (
              <>
                <button
                  type="button"
                  aria-label="Chauffeur précédent"
                  onClick={() => go(-1)}
                  className="absolute top-1/2 left-2 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-primary/25 bg-card/90 text-primary shadow-sm backdrop-blur transition-transform active:scale-95"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Chauffeur suivant"
                  onClick={() => go(1)}
                  className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-primary/25 bg-card/90 text-primary shadow-sm backdrop-blur transition-transform active:scale-95"
                >
                  <ChevronRight className="size-4" />
                </button>
              </>
            ) : null}
          </div>

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
