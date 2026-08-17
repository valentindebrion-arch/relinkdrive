import { describe, expect, it } from "vitest";
import {
  evaluateCompatibility,
  parseServerIncompatibility,
  type RideRequirements,
  type VehicleCapacity,
} from "./compatibility";

const base: VehicleCapacity = {
  vehicle_id: "v1",
  brand: "Tesla",
  model: "Model 3",
  max_passengers: 4,
  luggage_capacity: 3,
  large_luggage_capacity: 2,
  cabin_luggage_capacity: 3,
  pets_policy: "refused",
  pets_max: null,
  pets_carrier_required: false,
  pets_conditions: null,
  child_seat: false,
  booster_seat: false,
  stroller_space: false,
  accessible: false,
  large_trunk: false,
};

const req = (o: Partial<RideRequirements> = {}): RideRequirements => ({
  passengers: 1,
  largeLuggage: 0,
  cabinLuggage: 0,
  petsCount: 0,
  petCarrier: false,
  equipmentNeeds: [],
  ...o,
});

const codes = (v: VehicleCapacity | null, r: RideRequirements) =>
  evaluateCompatibility(v, r).blockingIssues.map((i) => i.code);

describe("moteur de compatibilité", () => {
  it("accepte 4 passagers pour une capacité de 4", () => {
    expect(evaluateCompatibility(base, req({ passengers: 4 })).compatible).toBe(true);
  });

  it("bloque 5 passagers pour une capacité de 4", () => {
    expect(codes(base, req({ passengers: 5 }))).toContain("passengers_exceeded");
  });

  it("accepte l'absence d'animal chez un chauffeur qui les refuse", () => {
    expect(evaluateCompatibility(base, req()).compatible).toBe(true);
  });

  it("bloque un animal chez un chauffeur qui les refuse", () => {
    expect(codes(base, req({ petsCount: 1 }))).toContain("pets_refused");
  });

  it("accepte un animal chez un chauffeur qui les accepte", () => {
    const v = { ...base, pets_policy: "accepted" as const };
    expect(evaluateCompatibility(v, req({ petsCount: 1 })).compatible).toBe(true);
  });

  it("bloque au-delà du nombre maximal d'animaux", () => {
    const v = { ...base, pets_policy: "accepted" as const, pets_max: 1 };
    expect(codes(v, req({ petsCount: 2 }))).toContain("pets_exceeded");
  });

  it("bloque un animal sans caisse quand elle est exigée", () => {
    const v = { ...base, pets_policy: "conditional" as const, pets_carrier_required: true };
    expect(codes(v, req({ petsCount: 1 }))).toContain("pets_carrier_required");
  });

  it("affiche les conditions animaux en avertissement", () => {
    const v = {
      ...base,
      pets_policy: "conditional" as const,
      pets_conditions: "Petits chiens uniquement",
    };
    const r = evaluateCompatibility(v, req({ petsCount: 1 }));
    expect(r.compatible).toBe(true);
    expect(r.warnings[0]?.code).toBe("pets_conditions");
  });

  it("accepte des bagages pile à la capacité", () => {
    expect(
      evaluateCompatibility(base, req({ largeLuggage: 2, cabinLuggage: 3 })).compatible,
    ).toBe(true);
  });

  it("bloque des grands bagages au-dessus de la capacité", () => {
    expect(codes(base, req({ largeLuggage: 3 }))).toContain("large_luggage_exceeded");
  });

  it("compare séparément grands bagages et bagages cabine", () => {
    const c = codes(base, req({ largeLuggage: 3, cabinLuggage: 4 }));
    expect(c).toEqual(
      expect.arrayContaining(["large_luggage_exceeded", "cabin_luggage_exceeded"]),
    );
  });

  it("retombe sur la capacité totale si le détail n'est pas renseigné", () => {
    const v = { ...base, large_luggage_capacity: null, cabin_luggage_capacity: null };
    expect(codes(v, req({ largeLuggage: 2, cabinLuggage: 2 }))).toContain("luggage_exceeded");
    expect(evaluateCompatibility(v, req({ largeLuggage: 2, cabinLuggage: 1 })).compatible).toBe(
      true,
    );
  });

  it("bloque une poussette sans espace dédié", () => {
    expect(codes(base, req({ equipmentNeeds: ["poussette"] }))).toContain("equipment_missing");
  });

  it("accepte un équipement disponible", () => {
    const v = { ...base, child_seat: true };
    expect(evaluateCompatibility(v, req({ equipmentNeeds: ["siege_enfant"] })).compatible).toBe(
      true,
    );
  });

  it("bloque un équipement indisponible", () => {
    expect(codes(base, req({ equipmentNeeds: ["siege_enfant"] }))).toContain("equipment_missing");
  });

  it("affiche toutes les incompatibilités en une fois", () => {
    const c = codes(
      base,
      req({ passengers: 5, largeLuggage: 4, petsCount: 1, equipmentNeeds: ["fauteuil"] }),
    );
    expect(c).toEqual(
      expect.arrayContaining([
        "passengers_exceeded",
        "large_luggage_exceeded",
        "pets_refused",
        "equipment_missing",
      ]),
    );
  });

  it("ne suppose jamais une capacité par défaut", () => {
    const v = { ...base, max_passengers: null };
    expect(codes(v, req())).toContain("passengers_unknown");
    expect(codes(null, req())).toContain("vehicle_missing");
  });

  it("traite les besoins libres comme indicatifs", () => {
    const r = evaluateCompatibility(base, req({ equipmentNeeds: ["autre", "pancarte"] }));
    expect(r.compatible).toBe(true);
    expect(r.warnings).toHaveLength(2);
  });

  it("attribue les conditions au chauffeur et non à ReLink", () => {
    const msgs = evaluateCompatibility(base, req({ passengers: 9, petsCount: 1 }))
      .blockingIssues.map((i) => i.message)
      .join(" ");
    expect(msgs).not.toMatch(/ReLink/i);
    expect(msgs).toMatch(/Ce chauffeur n'accepte pas les animaux/);
  });

  it("relit une incompatibilité renvoyée par le serveur", () => {
    const parsed = parseServerIncompatibility(
      'ride_incompatible: {"compatible": false, "blockingIssues": [{"code":"pets_refused","field":"pets","message":"Ce chauffeur n\'accepte pas les animaux à bord de ce véhicule."}], "warnings": []}',
    );
    expect(parsed?.blockingIssues[0]?.code).toBe("pets_refused");
  });
});
