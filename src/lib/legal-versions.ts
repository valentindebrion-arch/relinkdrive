/**
 * Versions des documents contractuels réellement publiés dans /legal/$doc.
 * Toute modification du texte d'un document doit s'accompagner d'une nouvelle version ici,
 * afin que l'acceptation enregistrée côté serveur reste traçable.
 */
export const LEGAL_VERSIONS = {
  cgu: "cgu-2026-08-12",
  cgv: "cgv-2026-08-12",
  /** Les conditions d'annulation font partie des CGV (aucun document séparé). */
  cancellation: "cgv-2026-08-12",
} as const;

export const LEGAL_LINKS = {
  cgu: "/legal/cgu",
  cgv: "/legal/cgv",
  cancellation: "/legal/cgv#annulation",
} as const;
