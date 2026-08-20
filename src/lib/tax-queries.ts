import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { normalizeQuote, type RideQuote, type TaxRegime } from "@/lib/tax";

export type TaxPeriod = {
  id: string;
  regime: TaxRegime;
  vat_rate: number | null;
  rate_label: string | null;
  vat_number: string | null;
  legal_mention: string | null;
  effective_from: string;
  created_at: string;
};

export type DriverTariff = {
  driver_id: string;
  price_per_km_ht: number;
  minimum_ht: number;
  basis: "ht" | "ttc" | "unqualified";
  basis_confirmed_at: string | null;
  pickup_pct: number;
  night_enabled: boolean;
  night_start: string;
  night_end: string;
  night_pct: number;
};

/** Historique fiscal complet du chauffeur connecté (jamais écrasé). */
export function useMyTaxPeriods() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tax-periods", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_tax_profiles")
        .select("*")
        .eq("driver_id", user!.id)
        .order("effective_from", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TaxPeriod[];
    },
  });
}

export function useMyTariff() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["driver-tariff", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_tariffs")
        .select("*")
        .eq("driver_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as DriverTariff | null;
    },
  });
}

/** Devis recalculé côté serveur : le client ne voit jamais un prix calculé par le navigateur seul. */
export function useRideQuote(params: {
  driverId: string | null | undefined;
  distanceKm: number | null | undefined;
  roundTrip: boolean;
  at?: string | null;
}) {
  const { driverId, distanceKm, roundTrip, at } = params;
  return useQuery({
    queryKey: ["ride-quote", driverId, distanceKm, roundTrip, at ?? null],
    enabled: !!driverId && typeof distanceKm === "number" && distanceKm >= 0,
    queryFn: async () =>
      fetchRideQuote({ driverId: driverId!, distanceKm: distanceKm!, roundTrip, at: at ?? null }),
  });
}

export async function fetchRideQuote(params: {
  driverId: string;
  distanceKm: number;
  roundTrip: boolean;
  at?: string | null;
  /** Horodatage complet du départ : sert au calcul du tarif de nuit. */
  atIso?: string | null;
}): Promise<RideQuote | null> {
  const { data, error } = await supabase.rpc("compute_ride_quote", {
    _driver: params.driverId,
    _distance_km: params.distanceKm,
    _round_trip: params.roundTrip,
    ...(params.at ? { _at: params.at } : {}),
    ...(params.atIso ? { _at_ts: params.atIso } : {}),
  } as never);
  if (error) throw error;
  const row = (data as unknown as Record<string, unknown>[] | null)?.[0] ?? null;
  return normalizeQuote(row);
}
