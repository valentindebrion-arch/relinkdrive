import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type MapsNamespace = any;

declare global {
  interface Window {
    google?: { maps: MapsNamespace };
    __relinkMapsReady?: Promise<void>;
  }
}


function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.__relinkMapsReady) return window.__relinkMapsReady;
  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as string | undefined;
  const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] as string | undefined;
  if (!key) return Promise.reject(new Error("Clé cartographie manquante"));
  window.__relinkMapsReady = new Promise<void>((resolve, reject) => {
    const cbName = "__relinkMapsInit";
    (window as unknown as Record<string, unknown>)[cbName] = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=geometry&callback=${cbName}${
      channel ? `&channel=${channel}` : ""
    }`;
    script.async = true;
    script.onerror = () => reject(new Error("Chargement de la carte impossible"));
    document.head.appendChild(script);
  });
  return window.__relinkMapsReady;
}

export function RouteMiniMap({ polyline, className }: { polyline: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!polyline) return;
    loadMaps()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;
        const path = window.google.maps.geometry.encoding.decodePath(polyline);
        const map = new window.google.maps.Map(ref.current, {
          disableDefaultUI: true,
          gestureHandling: "cooperative",
          zoom: 12,
          center: path[0] ?? { lat: 45.7772, lng: 3.087 },
          styles: RELINK_MAP_STYLE,
        });
        new window.google.maps.Polyline({
          path,
          map,
          strokeColor: "#00a86b",
          strokeWeight: 5,
          strokeOpacity: 0.95,
        });

        if (path.length) {
          const bounds = new window.google.maps.LatLngBounds();
          path.forEach((p: any) => bounds.extend(p));
          map.fitBounds(bounds, 32);
          new window.google.maps.Marker({ position: path[0]!, map, label: "A" });
          new window.google.maps.Marker({ position: path[path.length - 1]!, map, label: "B" });
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [polyline]);

  if (error) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-border bg-muted text-xs text-muted-foreground ${className ?? "h-44"}`}>
        Aperçu de carte indisponible
      </div>
    );
  }
  return <div ref={ref} className={`overflow-hidden rounded-xl border border-border ${className ?? "h-44"}`} />;
}
