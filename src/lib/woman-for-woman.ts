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
