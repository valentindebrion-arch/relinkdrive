/**
 * Génération Factur-X (PDF lisible + XML CII intégré) à partir du modèle
 * structuré unique. Le XML est produit par `node-zugferd` (profils Factur-X
 * 1.07.3 / EN 16931), pas par un schéma maison, et il est embarqué dans le PDF
 * avec les métadonnées attendues par la spécification.
 *
 * Limite connue et assumée : la validation XSD officielle de la bibliothèque
 * s'appuie sur `xsd-schema-validator` (dépendance Java) qui ne peut pas être
 * exécutée dans l'environnement de ReLink. Le mode strict est donc désactivé et
 * la conformité est contrôlée par nos règles métier (`validate.ts`).
 */
import type { StructuredInvoice } from "@/lib/einvoicing/model";
import { FACTURX_PROFILE, FACTURX_SPEC_VERSION } from "@/lib/einvoicing/spec";

const amount = (n: number) => n.toFixed(2);

// `node-zugferd` (et son interop tslib) casse à l'initialisation dans le
// runtime serveur : on le charge donc uniquement au moment de générer un
// document, jamais au chargement de l'application.
type Invoicer = { create: (data: never) => {
  toXML: () => Promise<string>;
  embedInPdf: (pdf: Uint8Array, opts: unknown) => Promise<Uint8Array>;
} };

let invoicerPromise: Promise<Invoicer> | undefined;

async function getInvoicer(): Promise<Invoicer> {
  if (!invoicerPromise) {
    invoicerPromise = (async () => {
      const [{ zugferd }, { EN16931 }] = await Promise.all([
        import("node-zugferd"),
        import("node-zugferd/profile/en16931"),
      ]);
      return zugferd({ profile: EN16931, strict: false }) as unknown as Invoicer;
    })();
  }
  return invoicerPromise;
}

function partyAddress(p: StructuredInvoice["seller"] | StructuredInvoice["buyer"]) {
  return {
    countryCode: p.countryCode,
    ...(p.address ? { line1: p.address } : {}),
    ...(p.postalCode ? { postCode: p.postalCode } : {}),
    ...(p.city ? { city: p.city } : {}),
  };
}

function buildDocumentData(doc: StructuredInvoice) {
  const seller = doc.seller;
  const buyer = doc.buyer;
  const notes = doc.legalMentions.map((content) => ({ content }));

  return {
    number: doc.number ?? "",
    typeCode: doc.typeCode,
    issueDate: new Date(doc.issueDate),
    includedNote: notes.length ? notes : undefined,
    transaction: {
      line: doc.lines.map((l) => ({
        identifier: l.id,
        tradeProduct: { name: l.name },
        tradeAgreement: { netTradePrice: { chargeAmount: amount(l.unitPriceHt) } },
        tradeDelivery: { billedQuantity: { amount: String(l.quantity), unitMeasureCode: l.unitCode } },
        tradeSettlement: {
          tradeTax: {
            typeCode: "VAT",
            categoryCode: l.vatCategoryCode,
            rateApplicablePercent: String(l.vatRate),
          },
          linetotalAmount: amount(l.lineTotalHt),
        },
      })),
      tradeAgreement: {
        ...(doc.poNumber ? { buyerReference: doc.poNumber } : {}),
        seller: {
          name: seller.legalName ?? seller.name,
          postalAddress: partyAddress(seller),
          ...(seller.siren
            ? { specifiedLegalOrganization: { identifier: { value: seller.siren, schemeIdentifier: "0002" } } }
            : {}),
          ...(seller.vatNumber
            ? { taxRegistration: { vatIdentifier: seller.vatNumber } }
            : {}),
          ...(seller.email ? { tradeContact: [{ emailAddress: { value: seller.email } }] } : {}),
        },
        buyer: {
          name: buyer.legalName ?? buyer.name,
          postalAddress: partyAddress(buyer),
          ...(buyer.siren
            ? { specifiedLegalOrganization: { identifier: { value: buyer.siren, schemeIdentifier: "0002" } } }
            : {}),
          ...(buyer.vatNumber ? { taxRegistration: { vatIdentifier: buyer.vatNumber } } : {}),
          ...(buyer.email ? { tradeContact: [{ emailAddress: { value: buyer.email } }] } : {}),
        },
      },
      tradeDelivery: doc.serviceDate
        ? { information: { deliveryDate: new Date(doc.serviceDate) } }
        : {},
      tradeSettlement: {
        currencyCode: doc.currency,
        vatBreakdown: doc.vatBreakdown.map((v) => ({
          calculatedAmount: amount(v.taxAmount),
          typeCode: "VAT",
          ...(v.exemptionReason ? { exemptionReason: v.exemptionReason } : {}),
          basisAmount: amount(v.basisAmount),
          categoryCode: v.categoryCode,
          rateApplicablePercent: String(v.rate),
        })),
        ...(doc.dueDate || doc.payment.terms
          ? {
              paymentTerms: {
                ...(doc.payment.terms ? { description: doc.payment.terms } : {}),
                ...(doc.dueDate ? { dueDate: new Date(doc.dueDate) } : {}),
              },
            }
          : {}),
        monetarySummation: {
          lineTotalAmount: amount(doc.totals.lineTotalHt),
          taxBasisTotalAmount: amount(doc.totals.totalHt),
          taxTotal: { amount: amount(doc.totals.totalVat), currencyCode: doc.currency },
          grandTotalAmount: amount(doc.totals.totalTtc),
          ...(doc.totals.prepaidAmount > 0 ? { paidAmount: amount(doc.totals.prepaidAmount) } : {}),
          duePayableAmount: amount(doc.totals.netToPay),
        },
      },
    },
  };
}

export type FacturXResult = {
  xml: string;
  pdf: Uint8Array;
  profile: string;
  specVersion: string;
};

/** Produit le XML CII seul (source structurée conservée à part). */
export async function buildFacturXXml(doc: StructuredInvoice): Promise<string> {
  const document = invoicer.create(buildDocumentData(doc) as never);
  return await document.toXML();
}

/** Produit le Factur-X : PDF lisible + XML CII intégré et métadonnées. */
export async function buildFacturX(doc: StructuredInvoice, readablePdf: Uint8Array): Promise<FacturXResult> {
  const document = invoicer.create(buildDocumentData(doc) as never);
  const xml = await document.toXML();
  const pdf = await document.embedInPdf(readablePdf, {
    metadata: {
      title: `${doc.documentType === "credit_note" ? "Avoir" : "Facture"} ${doc.number ?? ""}`.trim(),
      author: doc.seller.legalName ?? doc.seller.name,
      subject: `${doc.operationCategory} — ${doc.lines[0]?.name ?? ""}`,
      keywords: ["Factur-X", "EN 16931", doc.number ?? ""].filter(Boolean),
    },
  });
  return { xml, pdf: pdf as Uint8Array, profile: FACTURX_PROFILE, specVersion: FACTURX_SPEC_VERSION };
}
