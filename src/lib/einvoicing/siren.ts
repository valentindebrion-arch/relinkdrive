/**
 * Vérification du SIREN d'un client professionnel.
 *
 * Distinction essentielle : un contrôle de clé (Luhn) prouve seulement que le
 * numéro est **mathématiquement valide**. Il ne prouve ni l'existence, ni
 * l'activité, ni la dénomination de l'entreprise. Tant qu'aucune source
 * autorisée (annuaire officiel / API entreprise) n'est raccordée, le résultat
 * reste « vérification impossible » et n'est jamais présenté comme officielle.
 */
import { supabase } from "@/integrations/supabase/client";
import { isValidSirenNumber } from "@/lib/einvoicing/validate";

export type SirenCheckResult =
  | "format_valid"
  | "format_invalid"
  | "found_active"
  | "found_inactive"
  | "not_found"
  | "name_mismatch"
  | "unavailable";

export const SIREN_RESULT_LABELS: Record<SirenCheckResult, string> = {
  format_valid: "Format valide (existence non vérifiée)",
  format_invalid: "Format invalide",
  found_active: "Entreprise trouvée et active",
  found_inactive: "Entreprise trouvée mais inactive",
  not_found: "Entreprise introuvable dans le registre",
  name_mismatch: "Dénomination différente du registre",
  unavailable: "Vérification impossible pour le moment",
};

export type SirenVerification = {
  result: SirenCheckResult;
  source: string;
  registryLegalName?: string | null;
  submittedLegalName?: string | null;
  nameMatch?: "match" | "mismatch" | "unknown";
  requiresConfirmation: boolean;
  message: string;
};

/**
 * Registre officiel non raccordé : `registryLookup` reste le point d'extension.
 * Le remplacer par un appel serveur à une source autorisée suffit à passer de
 * « format valide » à une vérification réelle, sans changer le reste du code.
 */
export type RegistryLookup = (siren: string) => Promise<{
  found: boolean;
  active?: boolean;
  legalName?: string | null;
} | null>;

export async function verifySiren(
  siren: string,
  submittedLegalName?: string | null,
  lookup?: RegistryLookup,
): Promise<SirenVerification> {
  if (!isValidSirenNumber(siren))
    return {
      result: "format_invalid",
      source: "checksum",
      requiresConfirmation: false,
      message: "Le SIREN doit comporter 9 chiffres et respecter sa clé de contrôle.",
      submittedLegalName: submittedLegalName ?? null,
    };

  if (!lookup)
    return {
      result: "format_valid",
      source: "checksum",
      requiresConfirmation: false,
      submittedLegalName: submittedLegalName ?? null,
      message:
        "Format valide. L'existence de l'entreprise n'a pas été vérifiée : aucune source officielle n'est raccordée.",
    };

  let registry: Awaited<ReturnType<RegistryLookup>> = null;
  try {
    registry = await lookup(siren);
  } catch {
    return {
      result: "unavailable",
      source: "registry",
      requiresConfirmation: false,
      submittedLegalName: submittedLegalName ?? null,
      message: "Le registre n'a pas pu être interrogé. Réessayez plus tard.",
    };
  }

  if (!registry || !registry.found)
    return {
      result: "not_found",
      source: "registry",
      requiresConfirmation: true,
      submittedLegalName: submittedLegalName ?? null,
      message: "Ce SIREN est mathématiquement valide mais introuvable dans le registre.",
    };

  const normalized = (v?: string | null) => (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const mismatch =
    !!submittedLegalName && !!registry.legalName && normalized(submittedLegalName) !== normalized(registry.legalName);

  if (mismatch)
    return {
      result: "name_mismatch",
      source: "registry",
      registryLegalName: registry.legalName ?? null,
      submittedLegalName: submittedLegalName ?? null,
      nameMatch: "mismatch",
      requiresConfirmation: true,
      message: `Le registre indique « ${registry.legalName} ». Confirmez la dénomination avant émission.`,
    };

  return {
    result: registry.active === false ? "found_inactive" : "found_active",
    source: "registry",
    registryLegalName: registry.legalName ?? null,
    submittedLegalName: submittedLegalName ?? null,
    nameMatch: "match",
    requiresConfirmation: registry.active === false,
    message: registry.active === false ? "Entreprise trouvée mais inactive." : "Entreprise trouvée et active.",
  };
}

export async function recordSirenVerification(args: {
  driverId: string;
  customerId?: string | null;
  siren: string;
  verification: SirenVerification;
  confirmedByDriver?: boolean;
}) {
  const { error } = await supabase.from("siren_verifications").insert({
    driver_id: args.driverId,
    customer_id: args.customerId ?? null,
    siren: args.siren,
    result: args.verification.result,
    source: args.verification.source,
    registry_legal_name: args.verification.registryLegalName ?? null,
    submitted_legal_name: args.verification.submittedLegalName ?? null,
    name_match: args.verification.nameMatch ?? "unknown",
    confirmed_by_driver: !!args.confirmedByDriver,
  });
  if (error) throw error;
}
