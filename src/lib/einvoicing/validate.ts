/**
 * Validation métier des données structurées avant émission ou transmission.
 *
 * La validation XSD officielle (Factur-X 1.07.3) s'appuie sur un validateur
 * Java qui n'est pas exécutable dans l'environnement d'exécution de ReLink :
 * on applique ici les règles de gestion EN 16931 / françaises utiles à
 * l'émission, avec des messages lisibles par le chauffeur. Aucun document
 * invalide ne peut être transmis.
 */
import type { StructuredInvoice } from "@/lib/einvoicing/model";

export type ValidationIssue = { code: string; message: string; severity: "error" | "warning" };
export type ValidationResult = { valid: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[] };

const err = (code: string, message: string): ValidationIssue => ({ code, message, severity: "error" });
const warn = (code: string, message: string): ValidationIssue => ({ code, message, severity: "warning" });

export function isValidSirenNumber(value?: string | null) {
  const s = (value ?? "").replace(/\D/g, "");
  if (s.length !== 9) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(s[8 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function isValidFrVatNumber(value?: string | null) {
  const s = (value ?? "").replace(/\s/g, "").toUpperCase();
  return /^FR[0-9A-Z]{2}\d{9}$/.test(s);
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

/** Validation complète : schéma minimal, montants, identifiants, régime, routage. */
export function validateStructuredInvoice(doc: StructuredInvoice): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // --- Émetteur -----------------------------------------------------------
  const s = doc.seller;
  if (!s.legalName) errors.push(err("SELLER_NAME", "La raison sociale de l'émetteur est manquante."));
  if (!s.legalForm) warnings.push(warn("SELLER_LEGAL_FORM", "La forme juridique de l'émetteur n'est pas renseignée."));
  if (!isValidSirenNumber(s.siren))
    errors.push(err("SELLER_SIREN", "Le SIREN de l'émetteur est manquant ou son format est invalide."));
  if (!s.siret) warnings.push(warn("SELLER_SIRET", "Le SIRET de l'émetteur n'est pas renseigné."));
  if (!s.address || !s.postalCode || !s.city)
    errors.push(err("SELLER_ADDRESS", "L'adresse complète de l'émetteur est incomplète (voie, code postal, ville)."));
  if (!s.countryCode) errors.push(err("SELLER_COUNTRY", "Le pays de l'émetteur est manquant."));
  if (!s.email) errors.push(err("SELLER_EMAIL", "L'email professionnel de l'émetteur est manquant."));
  if (s.vatRegime === "liable") {
    if (!s.vatNumber)
      errors.push(err("SELLER_VAT", "Le numéro de TVA intracommunautaire est obligatoire pour un émetteur assujetti."));
    else if (s.countryCode === "FR" && !isValidFrVatNumber(s.vatNumber))
      errors.push(err("SELLER_VAT_FORMAT", "Le format du numéro de TVA intracommunautaire de l'émetteur est invalide."));
    if (s.vatFranchise)
      errors.push(
        err("VAT_REGIME_CONFLICT", "La mention de franchise en base est incompatible avec le régime configuré."),
      );
  } else if (!doc.legalMentions.some((m) => m.toLowerCase().includes("293 b"))) {
    errors.push(err("VAT_FRANCHISE_MENTION", "La mention de franchise en base de TVA (art. 293 B du CGI) est manquante."));
  }

  // --- Destinataire -------------------------------------------------------
  const b = doc.buyer;
  if (!b.name) errors.push(err("BUYER_NAME", "L'identité du client facturé est manquante."));
  if (!b.countryCode) errors.push(err("BUYER_COUNTRY", "Le pays du client facturé est manquant."));
  if (b.kind === "company_fr") {
    if (!isValidSirenNumber(b.siren))
      errors.push(err("BUYER_SIREN", "Le SIREN du client professionnel est manquant ou son format est invalide."));
    if (!b.address || !b.postalCode || !b.city)
      errors.push(err("BUYER_ADDRESS", "L'adresse du client professionnel est incomplète."));
    if (b.vatNumber && !isValidFrVatNumber(b.vatNumber))
      warnings.push(warn("BUYER_VAT_FORMAT", "Le format du numéro de TVA du client semble invalide."));
  }
  if (b.kind === "company_foreign") {
    if (!b.vatNumber && !b.foreignTaxId)
      errors.push(err("BUYER_FOREIGN_ID", "Le numéro de TVA ou l'identifiant fiscal du client étranger est manquant."));
    if (b.countryCode === "FR")
      warnings.push(warn("BUYER_FOREIGN_COUNTRY", "Le client est marqué étranger mais son pays est la France."));
  }
  if (b.kind === "individual" && b.siren)
    warnings.push(warn("BUYER_INDIVIDUAL_SIREN", "Un SIREN est renseigné sur un client particulier."));

  // --- Document -----------------------------------------------------------
  if (!doc.number) errors.push(err("DOC_NUMBER", "Le numéro de facture définitif est manquant."));
  if (!doc.issueDate) errors.push(err("DOC_ISSUE_DATE", "La date d'émission est manquante."));
  if (!doc.serviceDate) errors.push(err("DOC_SERVICE_DATE", "La date de la prestation est manquante."));
  if (doc.currency !== "EUR") warnings.push(warn("DOC_CURRENCY", "La devise n'est pas l'euro."));
  if (doc.documentType === "credit_note" && !doc.originalInvoiceNumber)
    errors.push(err("DOC_CREDIT_ORIGIN", "L'avoir doit référencer le numéro de la facture d'origine."));
  if (doc.operationCategory !== "services")
    errors.push(err("DOC_CATEGORY", "La catégorie d'opération doit être « prestation de services »."));

  // --- Lignes et montants -------------------------------------------------
  if (doc.lines.length === 0) errors.push(err("LINES_EMPTY", "La facture ne comporte aucune ligne."));
  doc.lines.forEach((l, i) => {
    if (!l.name) errors.push(err("LINE_NAME", `La désignation de la ligne ${i + 1} est manquante.`));
    if (!(l.quantity > 0)) errors.push(err("LINE_QTY", `La quantité de la ligne ${i + 1} doit être supérieure à zéro.`));
    if (!near(Math.round(l.quantity * l.unitPriceHt * 100) / 100, l.lineTotalHt))
      errors.push(
        err("LINE_TOTAL", `Le total HT de la ligne ${i + 1} ne correspond pas à la quantité multipliée par le prix unitaire.`),
      );
    if (l.vatCategoryCode === "E" && !l.exemptionReason)
      errors.push(err("LINE_EXEMPTION", `Le motif d'exonération de TVA de la ligne ${i + 1} est manquant.`));
    if (l.vatCategoryCode === "S" && !(l.vatRate > 0))
      errors.push(err("LINE_VAT_RATE", `Le taux de TVA de la ligne ${i + 1} est manquant.`));
  });

  const lineSum = Math.round(doc.lines.reduce((a, l) => a + l.lineTotalHt, 0) * 100) / 100;
  if (!near(lineSum, doc.totals.totalHt))
    errors.push(err("TOTAL_HT", "Le total HT ne correspond pas à la somme des lignes."));

  const vatSum = Math.round(doc.vatBreakdown.reduce((a, v) => a + v.taxAmount, 0) * 100) / 100;
  if (!near(vatSum, doc.totals.totalVat))
    errors.push(err("TOTAL_VAT", "Le total de TVA ne correspond pas à la ventilation par taux."));
  if (!near(Math.round((doc.totals.totalHt + doc.totals.totalVat) * 100) / 100, doc.totals.totalTtc))
    errors.push(err("TOTAL_TTC", "Le montant TTC ne correspond pas au total HT et à la TVA."));
  if (!near(Math.round((doc.totals.totalTtc - doc.totals.prepaidAmount) * 100) / 100, doc.totals.netToPay))
    errors.push(err("NET_TO_PAY", "Le net à payer ne correspond pas au TTC diminué des acomptes."));
  if (doc.documentType === "invoice" && !(doc.totals.totalTtc > 0))
    errors.push(err("TOTAL_POSITIVE", "Le montant TTC d'une facture doit être supérieur à zéro."));

  doc.vatBreakdown.forEach((v) => {
    const expected = v.categoryCode === "S" ? Math.round(v.basisAmount * v.rate) / 100 : 0;
    if (!near(Math.round(expected * 100) / 100, v.taxAmount))
      errors.push(err("VAT_BREAKDOWN", "Le montant de TVA ne correspond pas à la base multipliée par le taux."));
    if (v.categoryCode === "E" && v.rate !== 0)
      errors.push(err("VAT_EXEMPT_RATE", "Un taux de TVA est indiqué alors que l'opération est exonérée."));
  });

  // --- Règlement et mentions B2B -----------------------------------------
  if (!doc.payment.terms) errors.push(err("PAYMENT_TERMS", "Les conditions de règlement sont manquantes."));
  if (!doc.dueDate) errors.push(err("DUE_DATE", "La date d'échéance est manquante."));
  if (doc.isB2B) {
    if (!doc.payment.latePenalty)
      errors.push(err("B2B_PENALTY", "La mention des pénalités de retard est obligatoire entre professionnels."));
    if (!doc.payment.recoveryFee)
      errors.push(err("B2B_RECOVERY", "La mention de l'indemnité forfaitaire de 40 € est obligatoire entre professionnels."));
  }

  return { valid: errors.length === 0, errors, warnings };
}

/** Contrôles supplémentaires exigés avant transmission via une plateforme agréée. */
export function validateRouting(doc: StructuredInvoice): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  if (doc.buyer.kind === "company_fr") {
    if (!doc.buyer.einvoicingAddress && !doc.buyer.routingId)
      errors.push(err("ROUTING_ADDRESS", "L'adresse électronique de facturation du client n'a pas été trouvée."));
    if (!doc.buyer.recipientPlatform)
      warnings.push(warn("ROUTING_PLATFORM", "La plateforme destinataire du client n'est pas renseignée."));
  }
  if (doc.buyer.kind === "individual" && doc.buyer.einvoicingAddress)
    warnings.push(
      warn("ROUTING_B2C", "Une adresse de facturation électronique est renseignée sur un particulier : l'opération relève de l'e-reporting."),
    );
  return { valid: errors.length === 0, errors, warnings };
}

/** Cohérence entre le PDF lisible et les données structurées embarquées. */
export function validatePdfXmlConsistency(doc: StructuredInvoice, xml: string): ValidationResult {
  const errors: ValidationIssue[] = [];
  const check = (value: string | null | undefined, code: string, message: string) => {
    if (!value) return;
    if (!xml.includes(value)) errors.push(err(code, message));
  };
  check(doc.number, "XML_NUMBER", "Le numéro de facture du PDF ne figure pas dans les données structurées.");
  check(doc.totals.totalTtc.toFixed(2), "XML_TTC", "Le montant TTC du PDF ne figure pas dans les données structurées.");
  check(doc.totals.totalHt.toFixed(2), "XML_HT", "Le total HT du PDF ne figure pas dans les données structurées.");
  check(doc.seller.siren, "XML_SELLER", "Le SIREN de l'émetteur ne figure pas dans les données structurées.");
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function mergeResults(...results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((r) => r.errors);
  const warnings = results.flatMap((r) => r.warnings);
  return { valid: errors.length === 0, errors, warnings };
}
