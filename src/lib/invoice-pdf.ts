import { jsPDF } from "jspdf";
import { formatDate, formatDateTime, formatEuro, PAYMENT_METHODS } from "@/lib/labels";

export type InvoiceIssuer = {
  full_name?: string | null;
  business_name?: string | null;
  siret?: string | null;
  vtc_card_number?: string | null;
  professional_address?: string | null;
  billing_legal_info?: string | null;
  vat_applicable?: boolean | null;
  public_phone?: string | null;
  email?: string | null;
};

export type InvoiceData = {
  number: string;
  issued_on: string;
  due_on?: string | null;
  description?: string | null;
  amount_ht: number;
  vat_rate: number;
  amount_ttc: number;
  status: string;
  payment_method?: string | null;
  paid_at?: string | null;
};

export type InvoiceRide = {
  pickup_address?: string | null;
  dropoff_address?: string | null;
  scheduled_at?: string | null;
  completed_at?: string | null;
  passengers?: number | null;
  mileage_km?: number | string | null;
};

export type InvoiceClient = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

const GREEN: [number, number, number] = [22, 132, 90];
const GREY: [number, number, number] = [110, 118, 128];

export function buildInvoicePdf(opts: {
  invoice: InvoiceData;
  issuer: InvoiceIssuer;
  client?: InvoiceClient | null;
  ride?: InvoiceRide | null;
}) {
  const { invoice, issuer, client, ride } = opts;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 16;
  let y = 18;

  const text = (s: string, x: number, yy: number, size = 10, bold = false, color = [17, 24, 39]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0]!, color[1]!, color[2]!);
    doc.text(s, x, yy);
  };

  // Header band
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.rect(0, 0, W, 6, "F");

  text("FACTURE", M, y, 20, true);
  text(`N° ${invoice.number}`, M, y + 7, 11, false, GREY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(GREY[0], GREY[1], GREY[2]);
  doc.text(`Date d'émission : ${formatDate(invoice.issued_on)}`, W - M, y, { align: "right" });

    doc.text(`Échéance : ${formatDate(invoice.due_on)}`, W - M, y + 5, { align: "right" });
  }
  y += 20;

  // Issuer / client blocks
  const blockTop = y;
  text("PRESTATAIRE (émetteur)", M, y, 8, true, GREY);
  y += 5;
  const issuerLines = [
    issuer.business_name || issuer.full_name || "Chauffeur VTC indépendant",
    issuer.professional_address || "",
    issuer.siret ? `SIRET : ${issuer.siret}` : "",
    issuer.vtc_card_number ? `Carte VTC n° ${issuer.vtc_card_number}` : "",
    issuer.public_phone ? `Tél. : ${issuer.public_phone}` : "",
    issuer.email || "",
  ].filter(Boolean) as string[];
  issuerLines.forEach((l) => {
    doc.splitTextToSize(l, 80).forEach((ln: string) => {
      text(ln, M, y, 9);
      y += 4.6;
    });
  });

  let yc = blockTop;
  const cx = W / 2 + 4;
  text("CLIENT", cx, yc, 8, true, GREY);
  yc += 5;
  const clientLines = [client?.full_name || "Client", client?.email || "", client?.phone || ""].filter(
    Boolean,
  ) as string[];
  clientLines.forEach((l) => {
    text(l, cx, yc, 9);
    yc += 4.6;
  });

  y = Math.max(y, yc) + 8;

  // Ride details
  if (ride) {
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(247, 250, 249);
    const boxY = y;
    const rideLines = [
      ride.scheduled_at ? `Date de la prestation : ${formatDateTime(ride.completed_at || ride.scheduled_at)}` : "",
      ride.pickup_address ? `Départ : ${ride.pickup_address}` : "",
      ride.dropoff_address ? `Arrivée : ${ride.dropoff_address}` : "",
      ride.passengers ? `Passagers : ${ride.passengers}` : "",
      ride.mileage_km ? `Distance : ${Number(ride.mileage_km)} km` : "",
    ].filter(Boolean) as string[];
    const wrapped = rideLines.flatMap((l) => doc.splitTextToSize(l, W - 2 * M - 8) as string[]);
    doc.roundedRect(M, boxY, W - 2 * M, wrapped.length * 4.8 + 10, 2, 2, "FD");
    let ry = boxY + 7;
    text("DÉTAIL DE LA COURSE", M + 4, ry, 8, true, GREY);
    ry += 5;
    wrapped.forEach((l) => {
      text(l, M + 4, ry, 9);
      ry += 4.8;
    });
    y = boxY + wrapped.length * 4.8 + 16;
  }

  // Table
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.rect(M, y, W - 2 * M, 8, "F");
  text("Désignation", M + 3, y + 5.5, 9, true, [255, 255, 255]);
  doc.setTextColor(255, 255, 255);
  doc.text("Montant HT", W - M - 3, y + 5.5, { align: "right" });
  y += 12;

  const desc = invoice.description || "Prestation de transport de personnes (VTC)";
  const descLines = doc.splitTextToSize(desc, W - 2 * M - 45) as string[];
  descLines.forEach((l, i) => {
    text(l, M + 3, y + i * 4.8, 9);
  });
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(formatEuro(invoice.amount_ht), W - M - 3, y, { align: "right" });
  y += descLines.length * 4.8 + 6;

  doc.setDrawColor(226, 232, 240);
  doc.line(M, y, W - M, y);
  y += 7;

  const totalRow = (label: string, value: string, bold = false, size = 9) => {
    text(label, W - M - 60, y, size, bold);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(17, 24, 39);
    doc.text(value, W - M - 3, y, { align: "right" });
    y += size === 9 ? 5.5 : 7;
  };

  totalRow("Total HT", formatEuro(invoice.amount_ht));
  totalRow(
    `TVA (${Number(invoice.vat_rate)} %)`,
    formatEuro(Number(invoice.amount_ttc) - Number(invoice.amount_ht)),
  );
  totalRow("Total TTC", formatEuro(invoice.amount_ttc), true, 12);

  y += 4;
  if (invoice.payment_method) {
    text(
      `Moyen de paiement : ${PAYMENT_METHODS[invoice.payment_method] ?? invoice.payment_method}`,
      M,
      y,
      9,
      false,
      GREY,
    );
    y += 5;
  }
  text(
    invoice.status === "paid"
      ? `Facture acquittée${invoice.paid_at ? ` le ${formatDate(invoice.paid_at)}` : ""}`
      : "Facture en attente de règlement",
    M,
    y,
    9,
    true,
  );
  y += 8;

  // Legal mentions
  const legal: string[] = [];
  if (!issuer.vat_applicable || Number(invoice.vat_rate) === 0) {
    legal.push(issuer.billing_legal_info || "TVA non applicable, art. 293 B du CGI.");
  } else if (issuer.billing_legal_info) {
    legal.push(issuer.billing_legal_info);
  }
  legal.push(
    "En cas de retard de paiement : pénalités au taux d'intérêt légal majoré et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 et D441-5 du Code de commerce). Pas d'escompte pour paiement anticipé.",
  );
  legal.push(
    "Prestation de transport public particulier de personnes réalisée par un exploitant VTC indépendant, seul responsable de l'exécution de la course et de l'exactitude des mentions de la présente facture.",
  );

  doc.setDrawColor(226, 232, 240);
  doc.line(M, y, W - M, y);
  y += 6;
  legal.forEach((l) => {
    (doc.splitTextToSize(l, W - 2 * M) as string[]).forEach((ln) => {
      text(ln, M, y, 7.5, false, GREY);
      y += 3.6;
    });
    y += 1.5;
  });

  // Disclaimer footer
  const disclaimer =
    "Document généré avec Relink. Relink est un logiciel de gestion (CRM) mis à disposition des chauffeurs indépendants : Relink n'est ni le prestataire du transport, ni l'émetteur de cette facture, n'encaisse aucun paiement et ne saurait être tenu responsable du contenu, des erreurs, omissions ou de la conformité fiscale du présent document, qui relèvent de la seule responsabilité du chauffeur émetteur.";
  const dy = 272;
  doc.setDrawColor(226, 232, 240);
  doc.line(M, dy - 4, W - M, dy - 4);
  let fy = dy;
  (doc.splitTextToSize(disclaimer, W - 2 * M) as string[]).forEach((ln) => {
    text(ln, M, fy, 6.8, false, GREY);
    fy += 3.2;
  });

  return doc;
}

export function invoiceFileName(number: string) {
  return `Facture-${number.replace(/[^\w-]/g, "")}.pdf`;
}

export function downloadInvoicePdf(opts: Parameters<typeof buildInvoicePdf>[0]) {
  const doc = buildInvoicePdf(opts);
  doc.save(invoiceFileName(opts.invoice.number));
}
