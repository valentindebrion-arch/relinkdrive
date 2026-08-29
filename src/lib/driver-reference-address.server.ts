/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Adresse de référence d'un chauffeur : point de retour à vide utilisé par le
 * planning. On privilégie toujours une adresse précise déjà enregistrée dans le
 * dossier professionnel, la ville n'étant qu'un dernier recours.
 */
export type DriverReference = {
  /** Adresse utilisable par le moteur d'itinéraire (null si aucune donnée fiable). */
  address: string | null;
  /** Libellé court affiché dans le planning ("Aubière"). */
  label: string | null;
  /** L'adresse est précise (et pas seulement une ville). */
  precise: boolean;
};

export async function getDriverReference(
  supabaseAdmin: any,
  driverId: string,
): Promise<DriverReference> {
  const [{ data: profile }, { data: dossier }] = await Promise.all([
    supabaseAdmin
      .from("driver_profiles")
      .select("professional_address, city")
      .eq("user_id", driverId)
      .maybeSingle(),
    supabaseAdmin
      .from("driver_dossier_details")
      .select("postal_address")
      .eq("driver_id", driverId)
      .maybeSingle(),
  ]);

  const precise = clean(profile?.professional_address) ?? clean(dossier?.postal_address) ?? null;
  const city = clean(profile?.city);

  if (precise) return { address: precise, label: city ?? shortLabel(precise), precise: true };
  if (city) return { address: city, label: city, precise: false };
  return { address: null, label: null, precise: false };
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length >= 4 ? v : null;
}

/** Dernier segment lisible d'une adresse ("12 rue X, 63170 Aubière" → "Aubière"). */
function shortLabel(address: string) {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const last = parts[parts.length - 1] ?? address;
  return last.replace(/^\d{4,5}\s*/, "") || last;
}
