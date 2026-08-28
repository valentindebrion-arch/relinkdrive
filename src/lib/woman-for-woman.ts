/**
 * Service « Woman for Woman » de ReLink.
 *
 * Le genre est une donnée strictement déclarative : elle n'est jamais déduite
 * du prénom, du nom, de la photo ou de l'e-mail. Elle sert uniquement à
 * autoriser la mise en relation femme → femme lorsque ce service est demandé.
 * Le contrôle définitif est refait côté serveur (fonctions et déclencheurs SQL).
 */

export type GenderValue = "female" | "male" | "undisclosed";

export const GENDER_OPTIONS: { value: GenderValue; label: string }[] = [
  { value: "female", label: "Femme" },
  { value: "male", label: "Homme" },
  { value: "undisclosed", label: "Autre / Je préfère ne pas préciser" },
];

export const GENDER_HELP =
  "Cette information peut être utilisée pour certains services spécifiques comme Woman for Woman.";

export const GENDER_FIELD_LABEL = "Genre / sexe pour les services de mise en relation";

export const WFW_LABEL = "Woman for Woman";

export const WFW_DRIVER_DESCRIPTION =
  "Je propose des trajets réservés aux clientes souhaitant voyager avec une chauffeuse.";

export const WFW_CLIENT_DESCRIPTION =
  "Je souhaite être mise en relation uniquement avec une chauffeuse proposant ce service.";

export const WFW_PUBLIC_DESCRIPTION =
  "Trajets disponibles pour les clientes souhaitant voyager avec une chauffeuse.";

export const WFW_CLIENT_PROFILE_REQUIRED =
  "Pour utiliser Woman for Woman, veuillez d'abord renseigner cette information dans votre profil.";

export const WFW_DRIVER_PROFILE_REQUIRED =
  "Indiquez « Femme » dans votre genre pour proposer le service Woman for Woman.";

export function genderLabel(value?: string | null) {
  return GENDER_OPTIONS.find((o) => o.value === value)?.label ?? "Non renseigné";
}

/** Le client peut-il demander le service ? (déclaration explicite requise) */
export function clientCanRequestWfw(gender?: string | null) {
  return gender === "female";
}

/** Le chauffeur peut-il activer le service ? */
export function driverCanOfferWfw(gender?: string | null) {
  return gender === "female";
}

/** Message serveur → message lisible pour l'utilisateur. */
export function isWfwServerError(message: string) {
  return /woman_for_woman_not_eligible/i.test(message);
}

export const WFW_SERVER_ERROR_MESSAGE =
  "Cette mise en relation Woman for Woman n'est pas possible : elle est réservée aux clientes et aux chauffeuses proposant ce service.";

/** Bloc « Informations personnelles » du chauffeur. */
export const WFW_DRIVER_OPT_IN_TITLE = "Je souhaite être éligible au service Woman for Woman";

export const WFW_DRIVER_OPT_IN_HELP =
  "Ce service permet d'être mise en relation uniquement avec des clientes compatibles avec Woman for Woman.";

/** Explication affichée en haut de la fiche publique d'une chauffeuse WFW. */
export const WFW_PUBLIC_HEADER_NOTICE =
  "Cette chauffeuse propose exclusivement des trajets Woman for Woman avec des clientes compatibles avec ce service.";

export const WFW_CLIENT_BLOCKED_TITLE = "Service réservé aux clientes Woman for Woman";

export const WFW_CLIENT_BLOCKED_HELP =
  "Cette chauffeuse propose uniquement des trajets Woman for Woman. Votre profil n'est pas compatible avec ce service.";

export const WFW_CLIENT_PROFILE_INCOMPLETE =
  "Pour ajouter cette chauffeuse, complétez d'abord votre profil afin de vérifier votre compatibilité avec Woman for Woman.";

export type WfwAccess = "ok" | "blocked" | "incomplete";

/**
 * Accès d'un compte client à une chauffeuse Woman for Woman.
 * Le contrôle définitif est refait côté base de données.
 */
export function wfwClientAccess(
  driverWomanForWoman: boolean | null | undefined,
  clientGender: string | null | undefined,
): WfwAccess {
  if (!driverWomanForWoman) return "ok";
  if (clientGender === "female") return "ok";
  if (!clientGender) return "incomplete";
  return "blocked";
}
