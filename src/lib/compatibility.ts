/**
 * Moteur de compatibilité centralisé ReLink.
 *
 * Compare les besoins déclarés par le client aux capacités objectives du
 * véhicule et aux conditions renseignées par le chauffeur.
 * Les règles sont strictement identiques à la fonction SQL
 * `public.check_ride_compatibility`, qui refait le contrôle côté serveur.
 *
 * ReLink ne décide jamais à la place du chauffeur : les messages énoncent
 * uniquement une capacité du véhicule ou une condition du chauffeur.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PetsPolicy = "accepted" | "refused" | "conditional";

export type VehicleCapacity = {
  vehicle_id: string;
  brand: string | null;
  model: string | null;
  max_passengers: number | null;
  luggage_capacity: number | null;
  large_luggage_capacity: number | null;
  cabin_luggage_capacity: number | null;
  pets_policy: PetsPolicy;
  pets_max: number | null;
  pets_carrier_required: boolean;
  pets_conditions: string | null;
  child_seat: boolean;
  booster_seat: boolean;
  stroller_space: boolean;
  accessible: boolean;
  large_trunk: boolean;
};

export type RideRequirements = {
  passengers: number;
  largeLuggage: number;
  cabinLuggage: number;
  petsCount: number;
  petType?: string | null;
  petCarrier: boolean;
  /** Clés d'équipements demandés (voir SPECIAL_NEEDS). */
  equipmentNeeds: string[];
};

export type CompatibilityIssue = {
  code: string;
  field: string;
  message: string;
  requestedValue?: number | string;
  allowedValue?: number | string;
};

export type CompatibilityWarning = { code: string; message: string };

export type CompatibilityResult = {
  compatible: boolean;
  blockingIssues: CompatibilityIssue[];
  warnings: CompatibilityWarning[];
};

const CONTACT = "Contactez votre chauffeur avant de réserver.";

/** Équipements dont l'absence bloque la réservation (contrainte stricte). */
export const EQUIPMENT_RULES: Record<
  string,
  { flag: keyof VehicleCapacity; message: string; label: string }
> = {
  siege_enfant: {
    flag: "child_seat",
    label: "Siège enfant",
    message: "Le siège enfant demandé n'est pas disponible dans ce véhicule.",
  },
  rehausseur: {
    flag: "booster_seat",
    label: "Rehausseur",
    message: "Le rehausseur demandé n'est pas disponible dans ce véhicule.",
  },
  poussette: {
    flag: "stroller_space",
    label: "Poussette",
    message: "Ce véhicule ne dispose pas de l'espace nécessaire pour une poussette.",
  },
  fauteuil: {
    flag: "accessible",
    label: "Fauteuil roulant",
    message: "Ce véhicule n'est pas équipé pour l'accessibilité en fauteuil roulant.",
  },
  accessibilite: {
    flag: "accessible",
    label: "Accessibilité",
    message: "Ce véhicule n'est pas équipé pour l'accessibilité en fauteuil roulant.",
  },
  bagages_volumineux: {
    flag: "large_trunk",
    label: "Bagages volumineux",
    message: "Ce véhicule ne dispose pas d'un grand coffre pour des bagages volumineux.",
  },
};

/** Besoins purement indicatifs : affichés au chauffeur, jamais bloquants. */
export const INFORMATIVE_NEEDS = ["pancarte", "autre"];

export function evaluateCompatibility(
  vehicle: VehicleCapacity | null | undefined,
  req: RideRequirements,
): CompatibilityResult {
  const blockingIssues: CompatibilityIssue[] = [];
  const warnings: CompatibilityWarning[] = [];

  if (!vehicle) {
    blockingIssues.push({
      code: "vehicle_missing",
      field: "vehicle",
      message: `Les caractéristiques du véhicule de ce chauffeur ne sont pas encore renseignées. ${CONTACT}`,
    });
    return { compatible: false, blockingIssues, warnings };
  }

  // Passagers
  if (vehicle.max_passengers == null) {
    blockingIssues.push({
      code: "passengers_unknown",
      field: "passengers",
      message: `La capacité en passagers de ce véhicule n'a pas encore été renseignée. ${CONTACT}`,
    });
  } else if (req.passengers > vehicle.max_passengers) {
    blockingIssues.push({
      code: "passengers_exceeded",
      field: "passengers",
      requestedValue: req.passengers,
      allowedValue: vehicle.max_passengers,
      message: `Ce véhicule peut accueillir jusqu'à ${vehicle.max_passengers} passagers. Vous avez indiqué ${req.passengers} passagers.`,
    });
  }

  // Bagages : modèle détaillé si le chauffeur l'a renseigné, sinon capacité totale.
  const total = req.largeLuggage + req.cabinLuggage;
  if (vehicle.large_luggage_capacity != null || vehicle.cabin_luggage_capacity != null) {
    if (vehicle.large_luggage_capacity != null) {
      if (req.largeLuggage > vehicle.large_luggage_capacity) {
        blockingIssues.push({
          code: "large_luggage_exceeded",
          field: "large_luggage",
          requestedValue: req.largeLuggage,
          allowedValue: vehicle.large_luggage_capacity,
          message: `La capacité déclarée de ce véhicule est de ${vehicle.large_luggage_capacity} grands bagages. Vous en avez indiqué ${req.largeLuggage}.`,
        });
      }
    } else if (req.largeLuggage > 0) {
      blockingIssues.push({
        code: "large_luggage_unknown",
        field: "large_luggage",
        message: `La capacité en grands bagages de ce véhicule n'a pas encore été renseignée. ${CONTACT}`,
      });
    }
    if (vehicle.cabin_luggage_capacity != null) {
      if (req.cabinLuggage > vehicle.cabin_luggage_capacity) {
        blockingIssues.push({
          code: "cabin_luggage_exceeded",
          field: "cabin_luggage",
          requestedValue: req.cabinLuggage,
          allowedValue: vehicle.cabin_luggage_capacity,
          message: `La capacité déclarée de ce véhicule est de ${vehicle.cabin_luggage_capacity} bagages cabine. Vous en avez indiqué ${req.cabinLuggage}.`,
        });
      }
    } else if (req.cabinLuggage > 0) {
      blockingIssues.push({
        code: "cabin_luggage_unknown",
        field: "cabin_luggage",
        message: `La capacité en bagages cabine de ce véhicule n'a pas encore été renseignée. ${CONTACT}`,
      });
    }
  } else if (vehicle.luggage_capacity != null) {
    if (total > vehicle.luggage_capacity) {
      blockingIssues.push({
        code: "luggage_exceeded",
        field: "luggage",
        requestedValue: total,
        allowedValue: vehicle.luggage_capacity,
        message: `La capacité déclarée de ce véhicule est de ${vehicle.luggage_capacity} bagages. Vous en avez indiqué ${total}.`,
      });
    }
  } else if (total > 0) {
    blockingIssues.push({
      code: "luggage_unknown",
      field: "luggage",
      message: `La capacité en bagages de ce véhicule n'a pas encore été renseignée. ${CONTACT}`,
    });
  }

  // Animaux
  if (req.petsCount > 0) {
    if (vehicle.pets_policy === "refused") {
      blockingIssues.push({
        code: "pets_refused",
        field: "pets",
        message: "Ce chauffeur n'accepte pas les animaux à bord de ce véhicule.",
      });
    } else {
      if (vehicle.pets_max != null && req.petsCount > vehicle.pets_max) {
        blockingIssues.push({
          code: "pets_exceeded",
          field: "pets",
          requestedValue: req.petsCount,
          allowedValue: vehicle.pets_max,
          message: `Ce chauffeur accepte jusqu'à ${vehicle.pets_max} animal(aux) à bord. Vous en avez indiqué ${req.petsCount}.`,
        });
      }
      if (vehicle.pets_carrier_required && !req.petCarrier) {
        blockingIssues.push({
          code: "pets_carrier_required",
          field: "pet_carrier",
          message:
            "Ce chauffeur accepte les animaux uniquement transportés dans une caisse ou un sac de transport.",
        });
      }
      if (vehicle.pets_policy === "conditional" && vehicle.pets_conditions) {
        warnings.push({
          code: "pets_conditions",
          message: `Conditions du chauffeur pour les animaux : ${vehicle.pets_conditions}`,
        });
      }
    }
  }

  // Équipements
  for (const key of req.equipmentNeeds) {
    const rule = EQUIPMENT_RULES[key];
    if (rule) {
      if (!vehicle[rule.flag]) {
        blockingIssues.push({
          code: "equipment_missing",
          field: key,
          message: rule.message,
        });
      }
      continue;
    }
    if (INFORMATIVE_NEEDS.includes(key)) {
      warnings.push({
        code: "informative",
        message:
          "Cette demande est transmise au chauffeur à titre indicatif : il reste libre de l'accepter.",
      });
    }
  }

  return { compatible: blockingIssues.length === 0, blockingIssues, warnings };
}

/** Charge les capacités du véhicule actif d'un chauffeur auquel le client est connecté. */
export function useDriverVehicleCapacity(driverId: string | null | undefined) {
  return useQuery({
    queryKey: ["driver-vehicle-capacity", driverId],
    enabled: !!driverId,
    staleTime: 30_000,
    queryFn: async (): Promise<VehicleCapacity | null> => {
      const { data, error } = await supabase.rpc("get_driver_vehicle_capacity", {
        _driver: driverId!,
      } as never);
      if (error) throw error;
      const row = (data as unknown as VehicleCapacity[] | null)?.[0] ?? null;
      return row;
    },
  });
}

/** Transforme la réponse SQL (`ride_incompatible: {...}`) en résultat structuré. */
export function parseServerIncompatibility(message: string): CompatibilityResult | null {
  const idx = message.indexOf("ride_incompatible:");
  if (idx < 0) return null;
  const json = message.slice(idx + "ride_incompatible:".length).trim();
  try {
    const parsed = JSON.parse(json) as CompatibilityResult;
    if (!Array.isArray(parsed.blockingIssues)) return null;
    return { compatible: false, blockingIssues: parsed.blockingIssues, warnings: parsed.warnings ?? [] };
  } catch {
    return null;
  }
}

/** Charge utile envoyée au serveur lors de la création de la demande. */
export function requirementsPayload(req: RideRequirements) {
  return {
    passengers: req.passengers,
    large_luggage: req.largeLuggage,
    cabin_luggage: req.cabinLuggage,
    pets_count: req.petsCount,
    pet_type: req.petType ?? null,
    pet_carrier: req.petCarrier,
    equipment_needs: req.equipmentNeeds,
  };
}
