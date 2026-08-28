import { useCallback, useEffect, useState } from "react";
import { resolveSector } from "@/lib/client-sector.functions";
import { departmentFromPostcode } from "@/lib/departments";

const STORAGE_KEY = "relink.client-sector";

export type SectorState = {
  /** Commune retenue — informative uniquement. */
  sector: string | null;
  /** Code département du client : c'est le vrai secteur de recherche. */
  department: string | null;
  /** Coordonnées de la commune (informatif). */
  lat: number | null;
  lng: number | null;
  /** Origine du secteur : position du navigateur ou choix manuel. */
  source: "geo" | "manual" | null;
  detecting: boolean;
  error: string | null;
};

type Stored = {
  sector: string;
  department: string | null;
  source: "geo" | "manual";
  lat: number | null;
  lng: number | null;
};

function readStored(): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (!parsed.sector) return null;
    return {
      sector: parsed.sector,
      department: typeof parsed.department === "string" ? parsed.department : null,
      source: parsed.source === "geo" ? "geo" : "manual",
      lat: typeof parsed.lat === "number" ? parsed.lat : null,
      lng: typeof parsed.lng === "number" ? parsed.lng : null,
    };
  } catch {
    return null;
  }
}

function persist(stored: Stored) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* stockage indisponible : le secteur reste valable pour la session */
  }
}

/**
 * Secteur du client : géolocalisation si autorisée, sinon dernier secteur choisi,
 * sinon sélection manuelle. Le département déduit pilote la découverte.
 */
export function useClientSector() {
  const [state, setState] = useState<SectorState>({
    sector: null,
    department: null,
    lat: null,
    lng: null,
    source: null,
    detecting: false,
    error: null,
  });

  const setManual = useCallback(
    (city: string, department: string | null, lat?: number, lng?: number) => {
      const point = { lat: lat ?? null, lng: lng ?? null };
      setState({
        sector: city,
        department,
        ...point,
        source: "manual",
        detecting: false,
        error: null,
      });
      persist({ sector: city, department, source: "manual", ...point });
    },
    [],
  );

  const detect = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, detecting: false, error: "Géolocalisation indisponible" }));
      return;
    }
    setState((s) => ({ ...s, detecting: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await resolveSector({
            data: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          });
          const department = res.department ?? departmentFromPostcode(res.postcode);
          const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setState({
            sector: res.city,
            department,
            ...point,
            source: "geo",
            detecting: false,
            error: null,
          });
          persist({ sector: res.city, department, source: "geo", ...point });
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
      setState({
        sector: stored.sector,
        department: stored.department,
        lat: stored.lat,
        lng: stored.lng,
        source: stored.source,
        detecting: false,
        error: null,
      });
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
