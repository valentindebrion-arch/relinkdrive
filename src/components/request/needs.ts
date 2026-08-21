/**
 * Besoins particuliers du parcours de réservation ReLink.
 *
 * Source unique partagée par l'étape « Options et demandes » et le
 * récapitulatif : libellés, icônes et sérialisation du champ `special_needs`.
 */
import {
  Accessibility,
  Baby,
  Dog,
  PackageOpen,
  Signpost,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type ReturnMode = "immediate" | "scheduled";

export type PetsState = {
  count: number;
  type: string;
  carrier: boolean;
};

export type SpecialNeedsState = {
  keys: string[];
  details: Record<string, string>;
};

export type SpecialNeed = {
  key: string;
  label: string;
  icon: LucideIcon;
  detail: string | null;
};

/** Clé virtuelle : l'animal est géré par l'état `pets`, jamais dans `equipment_needs`. */
export const PET_NEED_KEY = "animal";

export const SPECIAL_NEEDS: SpecialNeed[] = [
  { key: "siege_enfant", label: "Siège enfant", icon: Baby, detail: "Âge de l'enfant" },
  { key: "rehausseur", label: "Rehausseur", icon: Baby, detail: null },
  { key: "poussette", label: "Poussette", icon: PackageOpen, detail: null },
  { key: "accessibilite", label: "Accessibilité", icon: Accessibility, detail: "Nature du besoin" },
  { key: "fauteuil", label: "Fauteuil roulant", icon: Accessibility, detail: null },
  {
    key: "bagages_volumineux",
    label: "Bagages volumineux",
    icon: PackageOpen,
    detail: "Dimensions approximatives",
  },
  { key: "pancarte", label: "Pancarte d'accueil", icon: Signpost, detail: "Texte à afficher" },
  { key: "autre", label: "Autre", icon: Sparkles, detail: "Précisez votre besoin" },
];

/** Option « Animal » présentée avec les autres, stockée séparément. */
export const PET_NEED: SpecialNeed = {
  key: PET_NEED_KEY,
  label: "Animal",
  icon: Dog,
  detail: "Type d'animal",
};

/** Texte métier envoyé dans `special_needs` (champ existant). */
export function serializeNeeds(state: SpecialNeedsState) {
  return state.keys
    .map((k) => {
      const item = SPECIAL_NEEDS.find((n) => n.key === k);
      if (!item) return "";
      const detail = state.details[k]?.trim();
      return detail ? `${item.label} (${detail})` : item.label;
    })
    .filter(Boolean)
    .join(", ");
}

export function needLabel(key: string) {
  return SPECIAL_NEEDS.find((n) => n.key === key)?.label ?? key;
}
