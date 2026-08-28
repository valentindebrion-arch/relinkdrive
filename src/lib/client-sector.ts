import { useCallback, useEffect, useState } from "react";
import { resolveSector } from "@/lib/client-sector.functions";

const STORAGE_KEY = "relink.client-sector";

export type SectorState = {
  /** Secteur retenu (ville) — null tant qu'aucune source n'a abouti. */
  sector: string | null;
  /** Origine du secteur : position du navigateur ou choix manuel. */
  source: "geo" | "manual" | null;
  detecting: boolean;
  error: string | null;
};

function readStored(): { sector: string; source: "geo" | "manual" } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sector?: string; source?: string };
    if (!parsed.sector) return null;
    return { sector: parsed.sector, source: parsed.source === "geo" ? "geo" : "manual" };
  } catch {
    return null;
  }
}

/**
 * Secteur du client : géolocalisation si autorisée, sinon dernier secteur choisi,
 * sinon sélection manuelle. La page « Trouver » ne doit jamais être bloquée.
 */
export function useClientSector() {
  const [state, setState] = useState<SectorState>({
    sector: null,
    source: null,
    detecting: false,
    error: null,
  });

  const setManual = useCallback((city: string) => {
    setState({ sector: city, source: "manual", detecting: false, error: null });
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sector: city, source: "manual" }));
    } catch {
      /* stockage indisponible : le secteur reste valable pour la session */
    }
  }, []);

  const detect = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, detecting: false, error: "Géolocalisation indisponible" }));
      return;
    }
    setState((s) => ({ ...s, detecting: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { city } = await resolveSector({
            data: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          });
          setState({ sector: city, source: "geo", detecting: false, error: null });
          try {
            window.localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ sector: city, source: "geo" }),
            );
          } catch {
            /* ignore */
          }
        } catch {
          setState((s) => ({ ...s, detecting: false, error: "Secteur introuvable" }));
        }
      },
      () => setState((s) => ({ ...s, detecting: false, error: "Position non autorisée" })),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setState({ sector: stored.sector, source: stored.source, detecting: false, error: null });
      return;
    }
    detect();
  }, [detect]);

  return { ...state, detect, setManual };
}

export type VehicleFilter = "all" | "sedan" | "van";

export const VEHICLE_FILTERS: { value: VehicleFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "sedan", label: "Berline · jusqu'à 4 places" },
  { value: "van", label: "Van · plus de 4 places" },
];

/**
 * Classement véhicule : la capacité déclarée prime, la catégorie sert d'appoint
 * lorsqu'elle mentionne explicitement un van/monospace.
 */
export function matchesVehicleFilter(
  filter: VehicleFilter,
  capacity: number | null | undefined,
  category: string | null | undefined,
) {
  if (filter === "all") return true;
  const cat = (category ?? "").toLowerCase();
  const isVanCategory = /van|monospace|minibus|mpv/.test(cat);
  const seats = typeof capacity === "number" ? capacity : null;
  const isVan = seats !== null ? seats > 4 || isVanCategory : isVanCategory;
  return filter === "van" ? isVan : !isVan;
}
