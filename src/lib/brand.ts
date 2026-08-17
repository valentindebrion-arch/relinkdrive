// Identité de marque provisoire — modifiable ici uniquement.
export const BRAND = {
  name: "Relink",
  tagline: "Votre clientèle. Votre planning. Votre outil.",
  subline:
    "ReLink aide les chauffeurs indépendants à gérer leurs réservations et à rester directement connectés à leurs clients.",
  driverPromise: "Conduisez. Fidélisez. Relink gère le reste.",
  driverPathPrefix: "/chauffeur",
} as const;

/** Formulations de positionnement réutilisables (à ne pas dupliquer ailleurs). */
export const POSITIONING = {
  /** Mention longue : CGU, création de compte, pied de page public. */
  responsibility:
    "ReLink est un outil de gestion et de mise en relation. La prestation de transport est proposée et réalisée sous la responsabilité exclusive du chauffeur indépendant sélectionné.",
  /** Mention courte : récapitulatif avant envoi d'une demande. */
  responsibilityShort:
    "Votre réservation est adressée directement au chauffeur, seul responsable de la prestation de transport.",
  /** Signature discrète des messages transmis (SMS, e-mails). */
  messageSignature:
    "Message transmis via ReLink, l'outil de réservation utilisé par votre chauffeur.",
  poweredBy: "Propulsé par ReLink",
} as const;
