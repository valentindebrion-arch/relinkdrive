/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { RELINK_MAP_STYLE, loadMaps } from "@/lib/google-maps";
import { reverseGeocode } from "@/lib/route-estimate.functions";
import { Button } from "@/components/ui/button";

/**
 * Sélection précise d'un point sur une carte plein écran.
 * La carte reste zoomable et déplaçable ; l'adresse est résolue au repos.
 */
export function MapPointPicker({
  title,
  onClose,
  onConfirm,
}: {
  title: string;
  onClose: () => void;
  onConfirm: (address: string) => void;
}) {
  const geocodeFn = useServerFn(reverseGeocode);
  const ref = useRef<HTMLDivElement>(null);
  const [address, setAddress] = useState("");
  const [resolving, setResolving] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    loadMaps()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;
        const map = new window.google.maps.Map(ref.current, {
          center: { lat: 45.7772, lng: 3.087 },
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          styles: RELINK_MAP_STYLE,
        });
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              !cancelled && map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => undefined,
            { timeout: 6000 },
          );
        }
        const resolve = () => {
          const c = map.getCenter();
          if (!c) return;
          setResolving(true);
          clearTimeout(timer);
          timer = setTimeout(async () => {
            try {
              const res = await geocodeFn({ data: { lat: c.lat(), lng: c.lng() } });
              if (!cancelled) setAddress(res.address);
            } catch {
              if (!cancelled) setAddress("");
            } finally {
              if (!cancelled) setResolving(false);
            }
          }, 500);
        };
        map.addListener("idle", resolve);
      })
      .catch((e: Error) => !cancelled && setMapError(e.message));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [geocodeFn]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      <div
        className="flex shrink-0 items-center gap-2 px-3 pb-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <button
          type="button"
          aria-label="Retour"
          onClick={onClose}
          className="flex size-10 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        <p className="text-[15px] font-bold">{title}</p>
      </div>

      <div className="relative min-h-0 flex-1">
        {mapError ? (
          <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
            La carte est momentanément indisponible. Saisissez l'adresse manuellement.
          </div>
        ) : (
          <>
            <div ref={ref} className="size-full" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-6">
              <MapPin className="size-9 text-primary drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)]" />
            </div>
          </>
        )}
      </div>

      <div
        className="shrink-0 space-y-3 bg-card px-4 pt-4 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <p className="min-h-10 text-[15px] font-semibold">
          {resolving ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Recherche de l'adresse…
            </span>
          ) : (
            address || "Déplacez la carte pour choisir un point"
          )}
        </p>
        <Button
          size="lg"
          className="h-13 w-full rounded-2xl text-[15px] font-bold"
          disabled={!address || resolving}
          onClick={() => onConfirm(address)}
        >
          Confirmer cette position
        </Button>
      </div>
    </div>
  );
}
