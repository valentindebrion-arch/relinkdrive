/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { CAR_SVG, RELINK_MAP_STYLE, loadMaps } from "@/lib/google-maps";

const FALLBACK = { lat: 45.7772, lng: 3.087 }; // Clermont-Ferrand

type FakeDriver = { lat: number; lng: number; heading: number; speed: number };

function makeDrivers(center: { lat: number; lng: number }, count: number): FakeDriver[] {
  return Array.from({ length: count }, (_, i) => ({
    lat: center.lat + (Math.random() - 0.5) * 0.014,
    lng: center.lng + (Math.random() - 0.5) * 0.02,
    heading: (i * 360) / count + Math.random() * 40,
    speed: 0.00007 + Math.random() * 0.00009,
  }));
}

/** Carte d'ambiance : position du client + chauffeurs fictifs qui circulent autour.
 *  Avec `polyline`, elle affiche en plus l'itinéraire A → B du trajet. */
export function LiveDriversMap({
  className,
  polyline,
  interactive = false,
  bare = false,
  onDriverSelect,
}: {
  className?: string;
  polyline?: string;
  /** Autorise le déplacement et le zoom tactile. */
  interactive?: boolean;
  /** Sans bordure ni coins arrondis (mode plein écran). */
  bare?: boolean;
  onDriverSelect?: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = (center: { lat: number; lng: number }) => {
      loadMaps()
        .then(() => {
          if (cancelled || !ref.current || !window.google) return;
          const maps = window.google.maps;
          const path: any[] = polyline
            ? maps.geometry.encoding.decodePath(polyline)
            : [];
          if (path.length) {
            center = { lat: path[0].lat(), lng: path[0].lng() };
          }
          const map = new maps.Map(ref.current, {
            disableDefaultUI: true,
            gestureHandling: interactive ? "greedy" : polyline ? "cooperative" : "none",
            keyboardShortcuts: false,
            zoom: 14,
            center,
            styles: RELINK_MAP_STYLE,
          });

          if (path.length) {
            new maps.Polyline({
              path,
              map,
              strokeColor: "#00a86b",
              strokeWeight: 5,
              strokeOpacity: 0.95,
            });
            const bounds = new maps.LatLngBounds();
            path.forEach((p: any) => bounds.extend(p));
            map.fitBounds(bounds, 32);
            new maps.Marker({ position: path[0], map, label: "A" });
            new maps.Marker({ position: path[path.length - 1], map, label: "B" });
          }

          if (!path.length) {
            // Halo de position du client
            new maps.Circle({
              map,
              center,
              radius: 260,
              strokeColor: "#00a86b",
              strokeOpacity: 0.35,
              strokeWeight: 1,
              fillColor: "#00a86b",
              fillOpacity: 0.12,
            });
            new maps.Marker({
              map,
              position: center,
              title: "Vous êtes ici",
              icon: {
                path: maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: "#00a86b",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 3,
              },
              zIndex: 50,
            });
          }

          const drivers = makeDrivers(center, 5);
          const markers = drivers.map(
            (d) =>
              new maps.Marker({
                map,
                position: { lat: d.lat, lng: d.lng },
                cursor: onDriverSelect ? "pointer" : undefined,
                icon: {
                  url: `data:image/svg+xml;charset=UTF-8,${CAR_SVG}`,
                  scaledSize: new maps.Size(30, 30),
                  anchor: new maps.Point(15, 15),
                },
              }),
          );
          if (onDriverSelect) {
            markers.forEach((m, i) => m.addListener("click", () => onDriverSelect(i)));
          }

          setReady(true);

          timer = setInterval(() => {
            drivers.forEach((d, i) => {
              d.heading += (Math.random() - 0.5) * 26;
              const rad = (d.heading * Math.PI) / 180;
              d.lat += Math.cos(rad) * d.speed;
              d.lng += Math.sin(rad) * d.speed * 1.4;
              // Reste dans la zone autour du client
              if (Math.abs(d.lat - center.lat) > 0.012) d.heading += 180;
              if (Math.abs(d.lng - center.lng) > 0.018) d.heading += 180;
              markers[i]!.setPosition({ lat: d.lat, lng: d.lng });
            });
          }, 900);
        })
        .catch((e: Error) => !cancelled && setError(e.message));
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          !cancelled && start({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => !cancelled && start(FALLBACK),
        { timeout: 6000 },
      );
    } else {
      start(FALLBACK);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [polyline, interactive, onDriverSelect]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-center text-xs text-muted-foreground ${bare ? "" : "rounded-2xl border border-border"} ${className ?? "h-40"}`}
      >
        Aperçu de carte indisponible
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden ${bare ? "" : "rounded-2xl border border-border"} ${className ?? "h-40"}`}
    >
      <div ref={ref} className="size-full" />
      {!ready ? <div className="absolute inset-0 animate-pulse bg-muted" /> : null}
      {bare ? null : (
      <div className="animate-fade-in pointer-events-none absolute bottom-2 left-2 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur">
        {polyline ? "Votre itinéraire" : "Chauffeurs autour de vous"}
      </div>
      )}
    </div>
  );
}
