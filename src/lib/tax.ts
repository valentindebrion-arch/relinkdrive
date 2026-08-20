/**
 * Gestion de la TVA propre à chaque chauffeur.
 * Relink n'est pas l'émetteur des factures : ces règles servent uniquement à
 * présenter au client le prix réellement payable et à ventiler correctement
 * HT / TVA / TTC sur la facture émise au nom du chauffeur.
 */

export type TaxRegime = "franchise" | "liable";

/** Mention légale par défaut d'une franchise en base (modifiable par le chauffeur). */
export const DEFAULT_FRANCHISE_MENTION = "TVA non applicable, art. 293 B du CGI";

/** Taux usuel d'une course VTC classique de transport de voyageurs en France métropolitaine. */
export const DEFAULT_TRANSPORT_RATE = 10;
export const DEFAULT_TRANSPORT_RATE_LABEL = "Transport de voyageurs";

export const RATE_WARNING =
  "Le taux normal d'une course VTC classique en France métropolitaine est généralement de 10 %. Utilisez un autre taux uniquement si votre situation fiscale le justifie.";

export const TAX_HELP =
  "Ce choix détermine le calcul des prix présentés à vos clients et les mentions figurant sur vos factures. Vérifiez votre situation auprès de votre comptable ou de l'administration fiscale.";

export const TARIFF_HELP =
  "ReLink ajoutera automatiquement la TVA applicable pour calculer le prix TTC présenté au client.";

/** Devis calculé côté serveur (fonction SQL compute_ride_quote). */
export type RideQuote = {
  amount_ht: number;
  vat_rate: number | null;
  vat_amount: number | null;
  amount_ttc: number;
  regime: TaxRegime;
  rate_label: string | null;
  vat_number: string | null;
  legal_mention: string | null;
  effective_from: string | null;
  tax_configured: boolean;
  tariff_confirmed: boolean;
  price_per_km_ht: number;
  minimum_ht: number;
  base_ht: number;
  rounding_ht: number;
  /** Offre du chauffeur ("free" = tarif ReLink imposé). */
  plan: "free" | "pro";
  km_amount: number;
  pickup_pct: number;
  pickup_amount: number;
  night_applied: boolean;
  night_pct: number;
  night_amount: number;
};

export function normalizeQuote(row: Record<string, unknown> | null | undefined): RideQuote | null {
  if (!row) return null;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    amount_ht: Number(row["amount_ht"] ?? 0),
    vat_rate: num(row["vat_rate"]),
    vat_amount: num(row["vat_amount"]),
    amount_ttc: Number(row["amount_ttc"] ?? 0),
    regime: (row["regime"] as TaxRegime) ?? "franchise",
    rate_label: (row["rate_label"] as string | null) ?? null,
    vat_number: (row["vat_number"] as string | null) ?? null,
    legal_mention: (row["legal_mention"] as string | null) ?? null,
    effective_from: (row["effective_from"] as string | null) ?? null,
    tax_configured: Boolean(row["tax_configured"]),
    tariff_confirmed: Boolean(row["tariff_confirmed"]),
    price_per_km_ht: Number(row["price_per_km_ht"] ?? 0),
    minimum_ht: Number(row["minimum_ht"] ?? 0),
    base_ht: Number(row["base_ht"] ?? 0),
    rounding_ht: Number(row["rounding_ht"] ?? 0),
    plan: row["plan"] === "pro" ? "pro" : "free",
    km_amount: Number(row["km_amount"] ?? 0),
    pickup_pct: Number(row["pickup_pct"] ?? 0),
    pickup_amount: Number(row["pickup_amount"] ?? 0),
    night_applied: Boolean(row["night_applied"]),
    night_pct: Number(row["night_pct"] ?? 0),
    night_amount: Number(row["night_amount"] ?? 0),
  };
}

/** Validation stricte d'un taux saisi : jamais vide, jamais 0, jamais > 100, 2 décimales max. */
export function validateRate(input: string): { ok: true; value: number } | { ok: false; error: string } {
  const raw = input.trim().replace(",", ".");
  if (!raw) return { ok: false, error: "Indiquez un taux de TVA." };
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    if (/^-/.test(raw)) return { ok: false, error: "Un taux de TVA ne peut pas être négatif." };
    if (/^\d+(\.\d{3,})$/.test(raw)) return { ok: false, error: "Deux décimales maximum." };
    return { ok: false, error: "Saisissez une valeur numérique (ex. 10 ou 10,5)." };
  }
  const value = Number(raw);
  if (value <= 0) {
    return {
      ok: false,
      error:
        "0 % ne représente pas la franchise en base. Sélectionnez le régime « TVA non applicable ».",
    };
  }
  if (value > 100) return { ok: false, error: "Un taux de TVA ne peut pas dépasser 100 %." };
  return { ok: true, value };
}

/** Normalisation : majuscules, sans espaces, format international conservé. */
export function normalizeVatNumber(input: string) {
  return input.replace(/[\s.\-]/g, "").toUpperCase();
}

/** Validation de format uniquement — elle ne confirme pas la situation fiscale réelle. */
export function isVatNumberFormatValid(input: string) {
  const v = normalizeVatNumber(input);
  if (!/^[A-Z]{2}[0-9A-Z]{2,13}$/.test(v)) return false;
  if (v.startsWith("FR")) return /^FR[0-9A-Z]{2}\d{9}$/.test(v);
  return true;
}

export function roundCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Ventilation d'un montant HT selon le régime. Miroir exact du calcul serveur. */
export function breakdownFromHt(amountHt: number, regime: TaxRegime, rate: number | null) {
  if (regime === "liable" && rate) {
    const vat = roundCents((amountHt * rate) / 100);
    return { ht: roundCents(amountHt), vat, ttc: roundCents(amountHt + vat), rate };
  }
  return { ht: roundCents(amountHt), vat: null, ttc: roundCents(amountHt), rate: null };
}

/** Conversion d'un ancien tarif TTC vers un tarif HT, à taux donné. */
export function htFromTtc(ttc: number, rate: number) {
  return roundCents(ttc / (1 + rate / 100));
}
