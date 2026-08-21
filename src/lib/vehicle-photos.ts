/**
 * Photos contextuelles du véhicule (parcours de réservation).
 *
 * Source unique : la ligne `vehicles` du véhicule actif du chauffeur, la même
 * que le moteur de compatibilité. Aucune image générique n'est jamais
 * substituée : une photo absente reste absente et l'interface l'annonce.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrls } from "@/lib/storage";

export type VehiclePhotoKind =
  | "exterior"
  | "side"
  | "front"
  | "interior"
  | "trunk"
  | "childSeat"
  | "access"
  | "pet";

export type VehicleMediaRow = {
  id: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  max_passengers: number | null;
  large_luggage_capacity: number | null;
  cabin_luggage_capacity: number | null;
  luggage_capacity: number | null;
  air_conditioning: boolean;
  child_seat: boolean;
  booster_seat: boolean;
  stroller_space: boolean;
  accessible: boolean;
  large_trunk: boolean;
  pets_policy: string | null;
  paths: Record<VehiclePhotoKind, string | null>;
};

const COLUMNS =
  "id, brand, model, color, max_passengers, large_luggage_capacity, cabin_luggage_capacity, luggage_capacity, air_conditioning, child_seat, booster_seat, stroller_space, accessible, large_trunk, pets_policy, is_primary, created_at, photo_url, photo_side_url, photo_front_url, photo_interior_url, photo_trunk_url, photo_child_seat_url, photo_access_url, photo_pet_url";

/** Charge la ligne véhicule active d'un chauffeur connecté au client. */
export function useDriverVehicleMedia(driverId: string | null | undefined) {
  const row = useQuery({
    queryKey: ["driver-vehicle-media", driverId],
    enabled: !!driverId,
    staleTime: 60_000,
    queryFn: async (): Promise<VehicleMediaRow | null> => {
      const { data, error } = await supabase
        .from("vehicles")
        .select(COLUMNS)
        .eq("driver_id", driverId!)
        .order("is_primary", { ascending: false })
        .order("created_at")
        .limit(1);
      if (error) throw error;
      const v = data?.[0] as Record<string, unknown> | undefined;
      if (!v) return null;
      const str = (k: string) => (typeof v[k] === "string" && v[k] ? (v[k] as string) : null);
      const num = (k: string) => (typeof v[k] === "number" ? (v[k] as number) : null);
      const bool = (k: string) => v[k] === true;
      return {
        id: String(v["id"]),
        brand: str("brand"),
        model: str("model"),
        color: str("color"),
        max_passengers: num("max_passengers"),
        large_luggage_capacity: num("large_luggage_capacity"),
        cabin_luggage_capacity: num("cabin_luggage_capacity"),
        luggage_capacity: num("luggage_capacity"),
        air_conditioning: bool("air_conditioning"),
        child_seat: bool("child_seat"),
        booster_seat: bool("booster_seat"),
        stroller_space: bool("stroller_space"),
        accessible: bool("accessible"),
        large_trunk: bool("large_trunk"),
        pets_policy: str("pets_policy"),
        paths: {
          exterior: str("photo_url"),
          side: str("photo_side_url"),
          front: str("photo_front_url"),
          interior: str("photo_interior_url"),
          trunk: str("photo_trunk_url"),
          childSeat: str("photo_child_seat_url"),
          access: str("photo_access_url"),
          pet: str("photo_pet_url"),
        },
      };
    },
  });

  const paths = row.data ? Object.values(row.data.paths) : [];
  const signed = useSignedUrls("vehicles", paths);

  const urlOf = (kind: VehiclePhotoKind): string | null => {
    const path = row.data?.paths[kind] ?? null;
    if (!path) return null;
    return signed.data?.[path] ?? null;
  };

  return {
    vehicle: row.data ?? null,
    isLoading: row.isLoading || (paths.filter(Boolean).length > 0 && signed.isLoading),
    urlOf,
    /** Photo de profil : côté d'abord, puis extérieure, puis face. */
    profileUrl: () => urlOf("side") ?? urlOf("exterior") ?? urlOf("front"),
    hasPhoto: (kind: VehiclePhotoKind) => !!row.data?.paths[kind],
  };
}

export type VehicleMedia = ReturnType<typeof useDriverVehicleMedia>;

/** Prénom d'usage du chauffeur, utilisé dans les mentions de responsabilité. */
export function firstName(fullName?: string | null) {
  const name = (fullName ?? "").trim();
  if (!name) return "votre chauffeur";
  return name.split(/\s+/)[0] ?? name;
}

export type CapacityTone = "ok" | "unknown" | "over";

/**
 * Indicateur de capacité bagages : vert / orange / rouge discret.
 * Une capacité non déclarée n'est jamais présentée comme confirmée.
 */
export function luggageCapacityState(
  vehicle: VehicleMediaRow | null,
  large: number,
  cabin: number,
  driver: string,
): { tone: CapacityTone; label: string } {
  if (!vehicle) return { tone: "unknown", label: `À confirmer avec ${driver}` };
  const declaredLarge = vehicle.large_luggage_capacity;
  const declaredCabin = vehicle.cabin_luggage_capacity;
  if (
    (declaredLarge != null && large > declaredLarge) ||
    (declaredCabin != null && cabin > declaredCabin)
  ) {
    return { tone: "over", label: "Cette quantité peut dépasser la capacité déclarée" };
  }
  if (large === 0 && cabin === 0) return { tone: "ok", label: "Capacité adaptée" };
  if (declaredLarge == null || declaredCabin == null) {
    return { tone: "unknown", label: `À confirmer avec ${driver}` };
  }
  return { tone: "ok", label: "Capacité adaptée" };
}
