// Identité de marque — ReLink, le réseau des chauffeurs VTC.
export const BRAND = {
  name: "Relink",
  tagline: "Votre réseau de chauffeurs VTC.",
  subline:
    "Découvrez des chauffeurs professionnels dans votre secteur, trouvez celui qui vous correspond et gardez vos chauffeurs préférés toujours à portée de main.",
  driverPromise: "Créez votre vitrine VTC",
  driverPathPrefix: "/chauffeur",
} as const;

/** Formulations de positionnement réutilisables (à ne pas dupliquer ailleurs). */
export const POSITIONING = {
  /** Mention longue : CGU, création de compte, pied de page public. */
  responsibility:
    "ReLink est un annuaire professionnel de chauffeurs VTC. ReLink n'organise, ne gère et n'exécute aucune course : la prestation de transport, son tarif définitif et ses conditions sont convenus directement entre le client et le chauffeur indépendant.",
  /** Mention courte affichée sous l'estimateur indicatif. */
  estimateDisclaimer:
    "Cette estimation est fournie à titre indicatif à partir des informations tarifaires renseignées par le chauffeur. Le tarif définitif, la disponibilité et les conditions de la prestation sont à convenir directement avec le chauffeur.",
  /** Mention courte : cartes et profils. */
  responsibilityShort:
    "ReLink met en visibilité les chauffeurs. La relation se poursuit directement avec le chauffeur.",
  poweredBy: "Propulsé par ReLink",
} as const;
