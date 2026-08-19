import { describe, expect, it } from "vitest";
import { buildStructuredInvoice, type InvoiceRow } from "@/lib/einvoicing/model";
import { validateRouting, validateStructuredInvoice } from "@/lib/einvoicing/validate";
import { buildFacturXXml } from "@/lib/einvoicing/facturx";

const issuer = {
  legal_name: "Relink Transport",
  legal_form: "SASU",
  siren: "552100554",
  siret: "55210055400015",
  vat_number: "FR40552100554",
  country_code: "FR",
  address: "12 rue des Lilas",
  postal_code: "75011",
  city: "Paris",
  email: "pro@example.com",
};

const b2bCustomer = {
  kind: "company_fr",
  display_name: "Hôtel Central",
  legal_name: "Hôtel Central SAS",
  siren: "652014051",
  country_code: "FR",
  address: "3 avenue de la Gare",
  postal_code: "69003",
  city: "Lyon",
  accounting_email: "compta@hotel.example",
  einvoicing_address: "652014051",
  recipient_platform: "PA-DEMO",
};

const baseRow: InvoiceRow = {
  id: "inv-1",
  number: "F-2026-000012",
  document_type: "invoice",
  issued_on: "2026-09-15",
  service_date: "2026-09-14T08:30:00.000Z",
  due_on: "2026-09-30",
  currency: "EUR",
  quantity: 2,
  unit_price_ht: 50,
  amount_ht: 100,
  amount_ttc: 110,
  vat_rate: 10,
  tax_regime: "liable",
  description: "Transport de personnes (VTC)",
  payment_terms: "net_days",
  payment_terms_days: 15,
  issuer_snapshot: issuer,
  customer_snapshot: b2bCustomer,
};

describe("modèle structuré", () => {
  it("calcule les totaux et la ventilation de TVA", () => {
    const doc = buildStructuredInvoice(baseRow);
    expect(doc.totals.totalHt).toBe(100);
    expect(doc.totals.totalVat).toBe(10);
    expect(doc.totals.netToPay).toBe(110);
    expect(doc.vatBreakdown[0]).toMatchObject({ categoryCode: "S", rate: 10, basisAmount: 100, taxAmount: 10 });
    expect(doc.isB2B).toBe(true);
    expect(doc.typeCode).toBe("380");
  });

  it("applique la franchise en base et son motif d'exonération", () => {
    const doc = buildStructuredInvoice({
      ...baseRow,
      tax_regime: "franchise",
      vat_rate: 0,
      amount_ttc: 100,
      tax_legal_mention: "TVA non applicable, art. 293 B du CGI",
    });
    expect(doc.vatBreakdown[0]!.categoryCode).toBe("E");
    expect(doc.totals.totalVat).toBe(0);
    expect(doc.legalMentions.some((m) => m.includes("293 B"))).toBe(true);
  });
});

describe("validation métier", () => {
  it("accepte une facture B2B complète", () => {
    const result = validateStructuredInvoice(buildStructuredInvoice(baseRow));
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("refuse un SIREN client invalide", () => {
    const doc = buildStructuredInvoice({
      ...baseRow,
      customer_snapshot: { ...b2bCustomer, siren: "123456789" },
    });
    const result = validateStructuredInvoice(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain("BUYER_SIREN");
  });

  it("refuse des totaux incohérents", () => {
    const result = validateStructuredInvoice(buildStructuredInvoice({ ...baseRow, amount_ttc: 130 }));
    expect(result.errors.map((e) => e.code)).toContain("VAT_BREAKDOWN");
  });

  it("exige une adresse de facturation électronique pour le routage B2B", () => {
    const doc = buildStructuredInvoice({
      ...baseRow,
      customer_snapshot: { ...b2bCustomer, einvoicing_address: null, routing_id: null },
    });
    expect(validateRouting(doc).valid).toBe(false);
  });
});

describe("Factur-X", () => {
  it("produit un XML CII contenant le numéro, le SIREN et les montants", async () => {
    const doc = buildStructuredInvoice(baseRow);
    const xml = await buildFacturXXml(doc);
    expect(xml).toContain("F-2026-000012");
    expect(xml).toContain("552100554");
    expect(xml).toContain("110.00");
    expect(xml).toContain("urn:cen.eu:en16931:2017");
  }, 20000);
});
