/**
 * Thèmes visuels de réservation ReLink.
 *
 * Un seul parcours de réservation existe : le thème n'agit que par variables CSS
 * appliquées sur un conteneur (scope). Les couleurs fonctionnelles (succès,
 * attente, information, erreur) restent lisibles dans tous les thèmes et sont
 * toujours accompagnées d'une icône et d'un libellé côté composants.
 */

export const BOOKING_THEME_IDS = [
  "relink_classic",
  "luxury_black_gold",
  "dynamic_red",
  "professional_blue",
  "women_for_women",
] as const;

export type BookingThemeId = (typeof BOOKING_THEME_IDS)[number];

export const DEFAULT_BOOKING_THEME: BookingThemeId = "relink_classic";

export function isBookingThemeId(value: unknown): value is BookingThemeId {
  return typeof value === "string" && (BOOKING_THEME_IDS as readonly string[]).includes(value);
}

/** Toute valeur inconnue ou invalide retombe sur le thème ReLink classique. */
export function normalizeBookingTheme(value: unknown): BookingThemeId {
  return isBookingThemeId(value) ? value : DEFAULT_BOOKING_THEME;
}

export type BookingTheme = {
  id: BookingThemeId;
  name: string;
  description: string;
  mood: string;
  /** Aperçu de palette (valeurs CSS). */
  swatches: string[];
  /** Thème sombre : utile pour adapter les fonds décoratifs. */
  dark: boolean;
  /** Variables appliquées dans le scope du parcours client. */
  vars: Record<string, string>;
  /** Dégradé du bandeau supérieur / écran de chargement. */
  banner: string;
  restricted?: "women_for_women";
};

/**
 * Chaque thème redéfinit à la fois les variables `--theme-*` (API publique du
 * système de thèmes) et les jetons shadcn du scope, afin que tous les composants
 * existants suivent le thème sans duplication de code.
 */
function makeVars(v: {
  primary: string;
  primaryHover: string;
  onPrimary: string;
  secondary: string;
  secondaryText: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  mutedText: string;
  border: string;
  accent: string;
  accentText: string;
  shadow: string;
  radius: string;
  destructive?: string;
}): Record<string, string> {
  return {
    // Jetons publics de l'identité visuelle du chauffeur
    "--driver-primary": v.primary,
    "--driver-primary-hover": v.primaryHover,
    "--driver-primary-pressed": v.primaryHover,
    "--driver-primary-soft": v.accent,
    "--driver-foreground": v.onPrimary,
    "--driver-border": v.border,
    "--driver-background-soft": v.secondary,
    "--driver-accent": v.accent,
    "--driver-text-accent": v.accentText,

    "--theme-primary": v.primary,

    "--theme-primary-hover": v.primaryHover,
    "--theme-secondary": v.secondary,
    "--theme-background": v.background,
    "--theme-surface": v.surface,
    "--theme-text": v.text,
    "--theme-muted-text": v.mutedText,
    "--theme-border": v.border,
    "--theme-accent": v.accent,
    "--theme-shadow": v.shadow,
    "--theme-radius": v.radius,
    "--theme-on-primary": v.onPrimary,

    // Jetons shadcn remappés dans le scope
    "--background": v.background,
    "--foreground": v.text,
    "--card": v.surface,
    "--card-foreground": v.text,
    "--popover": v.surface,
    "--popover-foreground": v.text,
    "--primary": v.primary,
    "--primary-foreground": v.onPrimary,
    "--secondary": v.secondary,
    "--secondary-foreground": v.secondaryText,
    "--muted": v.muted,
    "--muted-foreground": v.mutedText,
    "--accent": v.accent,
    "--accent-foreground": v.accentText,
    "--border": v.border,
    "--input": v.border,
    "--ring": v.primary,
    "--radius": v.radius,
    "--shadow-card": v.shadow,
    ...(v.destructive ? { "--destructive": v.destructive } : {}),
  };
}

export const BOOKING_THEMES: BookingTheme[] = [
  {
    id: "relink_classic",
    name: "ReLink classique",
    description:
      "L'univers ReLink d'origine : vert naturel, blanc et gris très clair. Moderne, écologique et accessible.",
    mood: "Moderne · écologique · accessible",
    swatches: [
      "oklch(0.63 0.15 158)",
      "oklch(0.86 0.09 160)",
      "#ffffff",
      "oklch(0.96 0.006 160)",
      "oklch(0.26 0.015 220)",
    ],
    dark: false,
    banner: "linear-gradient(135deg, oklch(0.63 0.15 158), oklch(0.55 0.13 165))",
    vars: makeVars({
      primary: "oklch(0.63 0.15 158)",
      primaryHover: "oklch(0.57 0.15 158)",
      onPrimary: "oklch(0.99 0.01 150)",
      secondary: "oklch(0.955 0.012 160)",
      secondaryText: "oklch(0.3 0.03 175)",
      background: "oklch(0.985 0.004 150)",
      surface: "oklch(1 0 0)",
      text: "oklch(0.26 0.015 220)",
      muted: "oklch(0.96 0.006 160)",
      mutedText: "oklch(0.53 0.018 220)",
      border: "oklch(0.91 0.008 165)",
      accent: "oklch(0.94 0.035 162)",
      accentText: "oklch(0.35 0.07 165)",
      shadow: "0 1px 2px oklch(0.2 0.02 160 / 6%), 0 8px 24px oklch(0.2 0.02 160 / 5%)",
      radius: "0.875rem",
    }),
  },
  {
    id: "luxury_black_gold",
    name: "Gold",
    description:
      "Base ivoire et blanc cassé rehaussée de doré. Un positionnement haut de gamme, lumineux et élégant.",
    mood: "Premium · lumineux · élégant",
    swatches: [
      "oklch(0.62 0.1 85)",
      "oklch(0.93 0.05 88)",
      "#ffffff",
      "oklch(0.97 0.02 90)",
      "oklch(0.3 0.02 85)",
    ],
    dark: false,
    banner: "linear-gradient(135deg, oklch(0.72 0.1 88), oklch(0.58 0.09 82))",
    vars: makeVars({
      primary: "oklch(0.6 0.1 82)",
      primaryHover: "oklch(0.54 0.1 82)",
      onPrimary: "oklch(0.99 0.01 90)",
      secondary: "oklch(0.96 0.02 90)",
      secondaryText: "oklch(0.36 0.05 85)",
      background: "oklch(0.988 0.008 92)",
      surface: "oklch(1 0 0)",
      text: "oklch(0.26 0.015 85)",
      muted: "oklch(0.965 0.014 90)",
      mutedText: "oklch(0.52 0.02 88)",
      border: "oklch(0.9 0.03 88)",
      accent: "oklch(0.95 0.04 88)",
      accentText: "oklch(0.42 0.09 82)",
      shadow: "0 1px 2px oklch(0.35 0.05 85 / 8%), 0 8px 24px oklch(0.35 0.05 85 / 7%)",
      radius: "0.875rem",
    }),
  },

  {
    id: "dynamic_red",
    name: "Rouge",
    description:
      "Rouge profond et blanc, ponctués d'anthracite. Une identité dynamique et affirmée, légèrement sportive.",
    mood: "Dynamique · énergique · sportif",
    swatches: [
      "oklch(0.45 0.17 22)",
      "oklch(0.92 0.05 22)",
      "#ffffff",
      "oklch(0.27 0.015 25)",
      "oklch(0.96 0.005 25)",
    ],
    dark: false,
    banner: "linear-gradient(135deg, oklch(0.45 0.17 22), oklch(0.38 0.14 18))",
    vars: makeVars({
      primary: "oklch(0.45 0.17 22)",
      primaryHover: "oklch(0.4 0.16 22)",
      onPrimary: "oklch(0.99 0.005 20)",
      secondary: "oklch(0.96 0.012 25)",
      secondaryText: "oklch(0.3 0.03 25)",
      background: "oklch(0.985 0.004 25)",
      surface: "oklch(1 0 0)",
      text: "oklch(0.25 0.015 25)",
      muted: "oklch(0.96 0.006 25)",
      mutedText: "oklch(0.5 0.02 25)",
      border: "oklch(0.9 0.012 25)",
      accent: "oklch(0.94 0.035 22)",
      accentText: "oklch(0.4 0.14 22)",
      shadow: "0 1px 2px oklch(0.2 0.02 25 / 8%), 0 8px 24px oklch(0.2 0.02 25 / 6%)",
      radius: "0.75rem",
      // Nuance d'erreur volontairement distincte du rouge décoratif du thème.
      destructive: "oklch(0.62 0.2 38)",
    }),
  },
  {
    id: "professional_blue",
    name: "Bleu",
    description:
      "Bleu nuit et bleu clair sur fond blanc et gris froid. Une image professionnelle, fiable et rassurante.",
    mood: "Professionnel · fiable · corporate",
    swatches: [
      "oklch(0.32 0.09 255)",
      "oklch(0.55 0.15 255)",
      "oklch(0.94 0.03 250)",
      "#ffffff",
      "oklch(0.55 0.02 250)",
    ],
    dark: false,
    banner: "linear-gradient(135deg, oklch(0.32 0.09 255), oklch(0.5 0.14 255))",
    vars: makeVars({
      primary: "oklch(0.5 0.15 255)",
      primaryHover: "oklch(0.44 0.14 255)",
      onPrimary: "oklch(0.99 0.005 250)",
      secondary: "oklch(0.955 0.012 250)",
      secondaryText: "oklch(0.32 0.05 255)",
      background: "oklch(0.98 0.005 250)",
      surface: "oklch(1 0 0)",
      text: "oklch(0.25 0.025 255)",
      muted: "oklch(0.955 0.008 250)",
      mutedText: "oklch(0.51 0.02 250)",
      border: "oklch(0.9 0.012 250)",
      accent: "oklch(0.94 0.03 250)",
      accentText: "oklch(0.35 0.1 255)",
      shadow: "0 1px 2px oklch(0.2 0.02 255 / 8%), 0 8px 24px oklch(0.2 0.02 255 / 6%)",
      radius: "0.875rem",
    }),
  },
  {
    id: "women_for_women",
    name: "Women for Women",
    description:
      "Violet profond, violine et rose poudré. Une identité chaleureuse, élégante et rassurante, sans stéréotype.",
    mood: "Chaleureux · élégant · sécurisant",
    swatches: [
      "oklch(0.38 0.13 315)",
      "oklch(0.55 0.17 330)",
      "oklch(0.92 0.04 350)",
      "#ffffff",
      "oklch(0.96 0.008 340)",
    ],
    dark: false,
    restricted: "women_for_women",
    banner: "linear-gradient(135deg, oklch(0.38 0.13 315), oklch(0.55 0.16 335))",
    vars: makeVars({
      primary: "oklch(0.45 0.16 318)",
      primaryHover: "oklch(0.4 0.15 318)",
      onPrimary: "oklch(0.99 0.005 330)",
      secondary: "oklch(0.955 0.015 335)",
      secondaryText: "oklch(0.35 0.07 320)",
      background: "oklch(0.985 0.006 335)",
      surface: "oklch(1 0 0)",
      text: "oklch(0.26 0.03 320)",
      muted: "oklch(0.96 0.008 335)",
      mutedText: "oklch(0.5 0.025 325)",
      border: "oklch(0.9 0.015 335)",
      accent: "oklch(0.93 0.035 345)",
      accentText: "oklch(0.4 0.12 325)",
      shadow: "0 1px 2px oklch(0.25 0.05 320 / 8%), 0 8px 24px oklch(0.25 0.05 320 / 6%)",
      radius: "1rem",
    }),
  },
];

export function getBookingTheme(id: unknown): BookingTheme {
  const normalized = normalizeBookingTheme(id);
  return BOOKING_THEMES.find((t) => t.id === normalized) ?? BOOKING_THEMES[0]!;
}

export type DriverBranding = {
  themeId: BookingThemeId;
  displayName: string | null;
  logoPath: string | null;
  coverPath: string | null;
  welcomeMessage: string | null;
};

export const DEFAULT_BRANDING: DriverBranding = {
  themeId: DEFAULT_BOOKING_THEME,
  displayName: null,
  logoPath: null,
  coverPath: null,
  welcomeMessage: null,
};

/** Ordre d'affichage du sélecteur « Style de ma vitrine ». */
export const DRIVER_THEME_ORDER: BookingThemeId[] = [
  "relink_classic",
  "professional_blue",
  "dynamic_red",
  "luxury_black_gold",
  "women_for_women",
];

/** Libellés courts utilisés par les pastilles de prévisualisation. */
export const DRIVER_THEME_SHORT_LABEL: Record<BookingThemeId, string> = {
  relink_classic: "ReLink",
  professional_blue: "Bleu",
  dynamic_red: "Rouge",
  luxury_black_gold: "Gold",
  women_for_women: "Woman for Woman",
};

export const DRIVER_THEME_OPTIONS = DRIVER_THEME_ORDER.map((id) => getBookingTheme(id));

/**
 * Accents seulement : utilisé sur les cartes chauffeur (Trouver, réseau, QR).
 * Le fond et le texte restent ceux de ReLink, seules les touches de couleur
 * (boutons, badges, bordures, icônes) suivent l'identité du chauffeur.
 */
export function driverAccentVars(theme: unknown): Record<string, string> {
  const t = getBookingTheme(theme);
  const v = t.vars;
  return {
    "--driver-primary": v["--driver-primary"]!,
    "--driver-primary-hover": v["--driver-primary-hover"]!,
    "--driver-primary-pressed": v["--driver-primary-pressed"]!,
    "--driver-primary-soft": v["--driver-primary-soft"]!,
    "--driver-foreground": v["--driver-foreground"]!,
    "--driver-border": v["--driver-border"]!,
    "--driver-background-soft": v["--driver-background-soft"]!,
    "--driver-accent": v["--driver-accent"]!,
    "--driver-text-accent": v["--driver-text-accent"]!,
    "--primary": v["--primary"]!,
    "--primary-foreground": v["--primary-foreground"]!,
    "--accent": v["--accent"]!,
    "--accent-foreground": v["--accent-foreground"]!,
    "--ring": v["--ring"]!,
  };
}

/**
 * Bouton d'action plein aux couleurs du chauffeur (ajout, retrait et leurs
 * confirmations). Aucune couleur n'est écrite en dur : tout provient des
 * jetons `--driver-*` posés par `driverAccentVars`.
 */
export const DRIVER_ACTION_BUTTON_CLASS =
  "bg-[var(--driver-primary,var(--primary))] text-[color:var(--driver-foreground,var(--primary-foreground))] hover:bg-[var(--driver-primary-hover,var(--primary))] focus-visible:ring-[var(--driver-primary,var(--primary))]";
