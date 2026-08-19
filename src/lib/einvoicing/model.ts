/**
 * Modèle structuré unique de la facture : source de vérité commune au PDF
 * lisible, au XML CII et au Factur-X. Aucun format ne recalcule ses propres
 * montants, ce qui évite toute divergence entre les représentations.
 */
import { CII_STANDARD } from "@/lib/einvoicing/spec";

export type Party = {
  name: string;
  legalName?: string | null;
  tradeName?: string | null;
  legalForm?: string | null;
  siren?: string | null;
  siret?: string | null;
  vatNumber?: string | null;
  foreignTaxId?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode: string;
  email?: string | null;
  phone?: string | null;
  /** Adresse électronique de facturation (routage plateforme agréée). */
  einvoicingAddress?: string | null;
  routingId?: string | null;
  routingScheme?: string | null;
  recipientPlatform?: string | null;
  addressOptOut?: boolean;
};

export type StructuredLine = {
  id: string;
  name: string;
  quantity: number;
  unitCode: "C62";
  unitPriceHt: number;
  lineTotalHt: number;
  vatCategoryCode: "S" | "E";
  vatRate: number;
  exemptionReason?: string | null;
};

export type VatBreakdown = {
  categoryCode: "S" | "E";
  rate: number;
  basisAmount: number;
  taxAmount: number;
  exemptionReason?: string | null;
};

export type StructuredInvoice = {
  standard: string;
  number: string | null;
  documentType: "invoice" | "credit_note";
  /** Code UNCL1001 : 380 facture, 381 avoir. */
  typeCode: "380" | "381";
  issueDate: string;
  serviceDate: string | null;
  dueDate: string | null;
  currency: string;
  originalInvoiceNumber?: string | null;
  operationCategory: "services";
  seller: Party & { vatRegime: "franchise" | "liable"; vatFranchise: boolean; vatOnDebits: boolean; vtcCardNumber?: string | null };
  buyer: Party & { kind: "individual" | "company_fr" | "company_foreign" };
  isB2B: boolean;
  passengerName?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  lines: StructuredLine[];
  vatBreakdown: VatBreakdown[];
  totals: {
    lineTotalHt: number;
    totalHt: number;
    totalVat: number;
    totalTtc: number;
    prepaidAmount: number;
    netToPay: number;
  };
  payment: {
    method?: string | null;
    terms: string;
    termsDays?: number | null;
    latePenalty: string | null;
    recoveryFee: string | null;
    noDiscount: string | null;
  };
  poNumber?: string | null;
  legalMentions: string[];
};

export type InvoiceRow = {
  id?: string;
  number: string | null;
  document_type?: string | null;
  issued_on: string;
  service_date?: string | null;
  due_on?: string | null;
  currency?: string | null;
  quantity?: number | string | null;
  unit_price_ht?: number | string | null;
  amount_ht: number | string;
  amount_ttc: number | string;
  amount_paid?: number | string | null;
  vat_rate?: number | string | null;
  description?: string | null;
  passenger_name?: string | null;
  payment_method?: string | null;
  payment_terms?: string | null;
  payment_terms_days?: number | null;
  po_number?: string | null;
  tax_regime?: string | null;
  tax_legal_mention?: string | null;
  tax_vat_number?: string | null;
  vat_on_debits?: boolean | null;
  operation_category?: string | null;
  customer_kind?: string | null;
  issuer_snapshot?: Record<string, unknown> | null;
  customer_snapshot?: Record<string, unknown> | null;
  credit_note_number?: string | null;
};

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const round2 = (n: number) => Math.round(n * 100) / 100;

const PAYMENT_TERMS_TEXT: Record<string, string> = {
  immediate: "Paiement immédiat",
  on_receipt: "À réception de facture",
  net_days: "Délai convenu",
};

export const LATE_PENALTY_MENTION =
  "Pénalités de retard : trois fois le taux d'intérêt légal en vigueur, exigibles sans rappel.";
export const RECOVERY_FEE_MENTION =
  "Indemnité forfaitaire pour frais de recouvrement : 40 € (art. L441-10 du code de commerce).";
export const NO_DISCOUNT_MENTION = "Pas d'escompte pour paiement anticipé.";
export const VAT_ON_DEBITS_MENTION = "TVA acquittée d'après les débits.";

/**
 * Construit le modèle structuré à partir d'une facture et de ses snapshots
 * figés à l'émission. Les snapshots priment toujours sur les données vivantes.
 */
export function buildStructuredInvoice(row: InvoiceRow, ride?: {
  pickup_address?: string | null;
  dropoff_address?: string | null;
} | null): StructuredInvoice {
  const iss = (row.issuer_snapshot ?? {}) as Record<string, unknown>;
  const cus = (row.customer_snapshot ?? {}) as Record<string, unknown>;

  const documentType: "invoice" | "credit_note" = row.document_type === "credit_note" ? "credit_note" : "invoice";
  const regime: "franchise" | "liable" = row.tax_regime === "liable" ? "liable" : "franchise";
  const vatRate = regime === "liable" ? num(row.vat_rate) : 0;
  const exemptionReason =
    regime === "liable" ? null : str(row.tax_legal_mention) ?? "TVA non applicable, art. 293 B du CGI";

  const quantity = num(row.quantity, 1) || 1;
  const totalHt = round2(num(row.amount_ht));
  const unitPriceHt = round2(num(row.unit_price_ht, totalHt / quantity));
  const totalTtc = round2(num(row.amount_ttc));
  const totalVat = round2(Math.max(totalTtc - totalHt, 0));
  const prepaid = round2(num(row.amount_paid));
  const kind = (str(cus["kind"]) ?? row.customer_kind ?? "individual") as
    | "individual"
    | "company_fr"
    | "company_foreign";
  const isB2B = kind !== "individual";
  const vatCategoryCode: "S" | "E" = regime === "liable" ? "S" : "E";

  const serviceDate = row.service_date ? new Date(row.service_date).toISOString() : null;
  const designation =
    str(row.description) ??
    `Prestation de transport VTC du ${new Date(serviceDate ?? row.issued_on).toLocaleDateString("fr-FR")}`;

  const legalMentions: string[] = [];
  if (regime !== "liable" && exemptionReason) legalMentions.push(exemptionReason);
  if (row.vat_on_debits) legalMentions.push(VAT_ON_DEBITS_MENTION);
  if (isB2B) {
    legalMentions.push(LATE_PENALTY_MENTION, RECOVERY_FEE_MENTION, NO_DISCOUNT_MENTION);
  }

  return {
    standard: CII_STANDARD,
    number: row.number,
    documentType,
    typeCode: documentType === "credit_note" ? "381" : "380",
    issueDate: row.issued_on.slice(0, 10),
    serviceDate,
    dueDate: row.due_on ? row.due_on.slice(0, 10) : null,
    currency: str(row.currency) ?? "EUR",
    originalInvoiceNumber: str(row.credit_note_number),
    operationCategory: "services",
    seller: {
      name: str(iss["legal_name"]) ?? str(iss["trade_name"]) ?? "",
      legalName: str(iss["legal_name"]),
      tradeName: str(iss["trade_name"]),
      legalForm: str(iss["legal_form"]),
      siren: str(iss["siren"]),
      siret: str(iss["siret"]),
      vatNumber: str(iss["vat_number"]) ?? str(row.tax_vat_number),
      address: str(iss["address"]),
      postalCode: str(iss["postal_code"]),
      city: str(iss["city"]),
      countryCode: str(iss["country_code"]) ?? "FR",
      email: str(iss["email"]),
      phone: str(iss["phone"]),
      einvoicingAddress: str(iss["einvoicing_address"]),
      vtcCardNumber: str(iss["vtc_card_number"]),
      vatRegime: regime,
      vatFranchise: regime !== "liable",
      vatOnDebits: !!row.vat_on_debits,
    },
    buyer: {
      kind,
      name: str(cus["legal_name"]) ?? str(cus["display_name"]) ?? "",
      legalName: str(cus["legal_name"]),
      siren: str(cus["siren"]),
      vatNumber: str(cus["vat_number"]),
      foreignTaxId: str(cus["foreign_tax_id"]),
      address: str(cus["address"]),
      postalCode: str(cus["postal_code"]),
      city: str(cus["city"]),
      countryCode: str(cus["country_code"]) ?? "FR",
      email: str(cus["accounting_email"]) ?? str(cus["email"]),
      phone: str(cus["phone"]),
      einvoicingAddress: str(cus["einvoicing_address"]),
      routingId: str(cus["routing_id"]),
      routingScheme: str(cus["routing_scheme"]),
      recipientPlatform: str(cus["recipient_platform"]),
      addressOptOut: cus["address_opt_out"] === true,
    },
    isB2B,
    passengerName: str(row.passenger_name),
    pickupAddress: str(ride?.pickup_address ?? null),
    dropoffAddress: str(ride?.dropoff_address ?? null),
    lines: [
      {
        id: "1",
        name: designation,
        quantity,
        unitCode: "C62",
        unitPriceHt,
        lineTotalHt: totalHt,
        vatCategoryCode,
        vatRate,
        exemptionReason,
      },
    ],
    vatBreakdown: [
      {
        categoryCode: vatCategoryCode,
        rate: vatRate,
        basisAmount: totalHt,
        taxAmount: totalVat,
        exemptionReason,
      },
    ],
    totals: {
      lineTotalHt: totalHt,
      totalHt,
      totalVat,
      totalTtc,
      prepaidAmount: prepaid,
      netToPay: round2(Math.max(totalTtc - prepaid, 0)),
    },
    payment: {
      method: str(row.payment_method),
      terms: PAYMENT_TERMS_TEXT[str(row.payment_terms) ?? "immediate"] ?? "Paiement immédiat",
      termsDays: row.payment_terms_days ?? null,
      latePenalty: isB2B ? LATE_PENALTY_MENTION : null,
      recoveryFee: isB2B ? RECOVERY_FEE_MENTION : null,
      noDiscount: isB2B ? NO_DISCOUNT_MENTION : null,
    },
    poNumber: str(row.po_number) ?? str(cus["po_number"]),
    legalMentions,
  };
}
