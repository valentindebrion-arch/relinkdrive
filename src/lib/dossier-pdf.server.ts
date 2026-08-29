/**
 * Génération serveur du dossier de vérification chauffeur au format PDF.
 * Aucune donnée fictive : toutes les valeurs proviennent des enregistrements
 * réellement transmis par le chauffeur.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DOCUMENTS_BUCKET,
  SECTION_DOCS,
  SECTION_LABELS,
  SECTION_ORDER,
  REQUIRED_DOCS,
  loadDossier,
  type SectionKey,
} from "@/lib/admin-dossier.server";

type Dossier = Awaited<ReturnType<typeof loadDossier>>;

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const GREEN = rgb(0.05, 0.45, 0.28);
const DARK = rgb(0.11, 0.13, 0.12);
const GREY = rgb(0.42, 0.45, 0.44);
const RED = rgb(0.65, 0.16, 0.16);
const LIGHT = rgb(0.96, 0.97, 0.96);

const DOCUMENT_LABELS: Record<string, string> = {
  identity: "Pièce d'identité (recto)",
  identity_back: "Pièce d'identité (verso)",
  driver_photo: "Photo du chauffeur",
  driving_license: "Permis de conduire (recto)",
  driving_license_back: "Permis de conduire (verso)",
  adcs: "Attestation ADCS",
  vtc_card: "Carte professionnelle VTC (recto)",
  vtc_card_back: "Carte professionnelle VTC (verso)",
  revtc_proof: "Justificatif REVTC",
  company_proof: "Justificatif d'entreprise (SIRET)",
  rne_kbis: "Extrait RNE / Kbis",
  insurance_rc: "Attestation RC professionnelle",
  insurance: "Assurance automobile VTC",
  registration: "Carte grise",
  inspection: "Contrôle technique",
  vehicle_ownership: "Justificatif d'utilisation du véhicule",
  other: "Autre justificatif",
};

const DOC_STATUS: Record<string, string> = {
  pending: "Reçu — en attente de contrôle",
  approved: "Validé",
  rejected: "Refusé",
  expired: "Expiré",
};

const VERIFICATION_LABELS: Record<string, string> = {
  incomplete: "Incomplet",
  pending: "Transmis, en attente",
  under_review: "Vérification en cours",
  verified: "Approuvé",
  changes_requested: "Correction demandée",
  rejected: "Refusé",
  suspended: "Suspendu",
  expired_documents: "Documents expirés",
};

const SECTION_STATE: Record<string, string> = {
  todo: "Pièces manquantes",
  review: "À contrôler",
  changes: "Correction demandée",
  expired: "Pièce expirée",
  approved: "Conforme",
};

/** Helvetica n'accepte que WinAnsi : on remplace les caractères hors jeu. */
function sanitize(text: string) {
  return text
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/\u20ac/g, "EUR")
    .replace(/[^\u0020-\u00ff\n]/g, "?");
}

function fr(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("fr-FR");
}

function frDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("fr-FR");
}

function val(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  return String(v);
}

/* ------------------------------------------------------------------ */
/* Mise en page séquentielle                                           */
/* ------------------------------------------------------------------ */

class Layout {
  page: PDFPage;
  y: number;
  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont,
  ) {
    this.page = doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }

  get width() {
    return A4[0] - MARGIN * 2;
  }

  newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }

  ensure(space: number) {
    if (this.y - space < MARGIN) this.newPage();
  }

  wrap(text: string, size: number, bold = false, maxWidth = this.width) {
    const font = bold ? this.bold : this.font;
    const words = sanitize(text).split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  text(
    content: string,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number } = {},
  ) {
    const size = opts.size ?? 10;
    const indent = opts.indent ?? 0;
    for (const line of this.wrap(content, size, opts.bold, this.width - indent)) {
      this.ensure(size + 4);
      this.page.drawText(line, {
        x: MARGIN + indent,
        y: this.y - size,
        size,
        font: opts.bold ? this.bold : this.font,
        color: opts.color ?? DARK,
      });
      this.y -= size + 4;
    }
  }

  gap(h = 8) {
    this.y -= h;
  }

  heading(title: string) {
    this.ensure(48);
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - 24,
      width: this.width,
      height: 24,
      color: GREEN,
    });
    this.page.drawText(sanitize(title), {
      x: MARGIN + 10,
      y: this.y - 17,
      size: 12,
      font: this.bold,
      color: rgb(1, 1, 1),
    });
    this.y -= 34;
  }

  field(label: string, value: string) {
    const size = 10;
    const labelWidth = 165;
    const lines = this.wrap(value, size, false, this.width - labelWidth);
    this.ensure(lines.length * (size + 3) + 6);
    this.page.drawText(sanitize(label), {
      x: MARGIN,
      y: this.y - size,
      size,
      font: this.bold,
      color: GREY,
    });
    lines.forEach((line, i) => {
      this.page.drawText(line, {
        x: MARGIN + labelWidth,
        y: this.y - size - i * (size + 3),
        size,
        font: this.font,
        color: DARK,
      });
    });
    this.y -= lines.length * (size + 3) + 5;
  }

  banner(text: string, color = LIGHT, textColor = DARK) {
    const lines = this.wrap(text, 9, false, this.width - 16);
    const height = lines.length * 12 + 10;
    this.ensure(height + 6);
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - height,
      width: this.width,
      height,
      color,
    });
    lines.forEach((line, i) => {
      this.page.drawText(line, {
        x: MARGIN + 8,
        y: this.y - 14 - i * 12,
        size: 9,
        font: this.font,
        color: textColor,
      });
    });
    this.y -= height + 6;
  }
}

/* ------------------------------------------------------------------ */
/* Contenus par section                                                */
/* ------------------------------------------------------------------ */

function sectionFields(key: SectionKey, d: Dossier): [string, string][] {
  const det = d.details;
  const v = d.vehicles[0];
  switch (key) {
    case "identity":
      return [
        ["Nom et prénom", val(d.profile?.full_name)],
        ["Date de naissance", fr(det?.birth_date)],
        ["Adresse postale", val(det?.postal_address)],
        ["Téléphone", val(d.profile?.phone)],
        ["Adresse e-mail", val(d.profile?.email)],
        ["Type de pièce d'identité", val(det?.id_doc_type)],
        ["Expiration de la pièce", fr(det?.id_doc_expires_on)],
      ];
    case "license":
      return [
        ["Numéro de permis", val(det?.license_number)],
        ["Catégories", val(det?.license_categories)],
        ["Date d'obtention", fr(det?.license_issued_on)],
        ["Date d'expiration", fr(det?.license_expires_on)],
      ];
    case "vtc":
      return [
        ["Numéro de carte VTC", val(d.driver?.vtc_card_number)],
        ["Autorité de délivrance", val(det?.vtc_authority)],
        ["Date de délivrance", fr(det?.vtc_issued_on)],
        ["Date d'expiration", fr(det?.vtc_expires_on)],
        ["Numéro REVTC", val(det?.revtc_number)],
      ];
    case "company":
      return [
        ["Raison sociale", val(d.company?.legal_name)],
        ["Forme juridique", val(d.company?.legal_form)],
        ["Nom commercial", val(det?.trade_name ?? d.driver?.business_name)],
        ["SIREN", val(det?.siren)],
        ["SIRET", val(d.company?.siret ?? d.driver?.siret)],
        [
          "Adresse de l'entreprise",
          val(
            [d.company?.address, d.company?.postal_code, d.company?.city]
              .filter(Boolean)
              .join(" ") || null,
          ),
        ],
        ["TVA intracommunautaire", val(d.company?.vat_number)],
      ];
    case "insurance":
      return [
        ["RC pro — compagnie", val(det?.rc_company)],
        ["RC pro — n° de contrat", val(det?.rc_contract)],
        ["RC pro — début", fr(det?.rc_starts_on)],
        ["RC pro — expiration", fr(det?.rc_expires_on)],
        ["Auto VTC — compagnie", val(det?.auto_company)],
        ["Auto VTC — n° de contrat", val(det?.auto_contract)],
        ["Auto VTC — début", fr(det?.auto_starts_on)],
        ["Auto VTC — expiration", fr(det?.auto_expires_on)],
        ["Plaque assurée", val(det?.auto_plate)],
      ];
    case "vehicle":
      return [
        ["Marque", val(v?.brand)],
        ["Modèle", val(v?.model)],
        ["Immatriculation", val(v?.plate)],
        ["Année", val(v?.year)],
        ["Couleur", val(v?.color)],
        ["Catégorie", val(v?.category)],
        ["Passagers / bagages", `${val(v?.max_passengers)} / ${val(v?.luggage_capacity)}`],
        ["Titulaire de la carte grise", val(det?.registration_holder)],
        ["Contrôle technique", fr(v?.inspection_expires_at)],
        ["Assurance véhicule", fr(v?.insurance_expires_at)],
      ];
    case "tax":
      return [
        ["Tarif au kilomètre", d.tariffs[0] ? `${d.tariffs[0].price_per_km_ht} EUR` : "—"],
        ["Course minimum", d.tariffs[0] ? `${d.tariffs[0].minimum_ht} EUR` : "—"],
      ];
  }
}

function detectKind(bytes: Uint8Array): "pdf" | "jpg" | "png" | "unknown" {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)
    return "pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "png";
  return "unknown";
}

/* ------------------------------------------------------------------ */
/* Génération complète                                                 */
/* ------------------------------------------------------------------ */

export async function buildDossierPdf(driverId: string) {
  const data = await loadDossier(driverId);
  const generatedAt = new Date();

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const layout = new Layout(pdf, font, bold);

  const fullName = data.profile?.full_name || data.driver?.business_name || "Chauffeur";
  const status = data.driver?.verification_status ?? "incomplete";
  const sectionStates = new Map((data.state?.sections ?? []).map((s) => [s.key, s.state] as const));
  const reviews = new Map(data.sectionReviews.map((r) => [r.section, r] as const));

  /* --- Page de couverture --- */
  layout.page.drawRectangle({ x: 0, y: A4[1] - 190, width: A4[0], height: 190, color: GREEN });
  layout.page.drawCircle({ x: MARGIN + 22, y: A4[1] - 62, size: 22, color: rgb(1, 1, 1) });
  layout.page.drawText("R", {
    x: MARGIN + 13,
    y: A4[1] - 72,
    size: 24,
    font: bold,
    color: GREEN,
  });
  layout.page.drawText("ReLink", {
    x: MARGIN + 56,
    y: A4[1] - 72,
    size: 22,
    font: bold,
    color: rgb(1, 1, 1),
  });
  layout.page.drawText(sanitize("Dossier de vérification chauffeur"), {
    x: MARGIN,
    y: A4[1] - 140,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });
  layout.page.drawText(sanitize("Document interne confidentiel"), {
    x: MARGIN,
    y: A4[1] - 162,
    size: 10,
    font,
    color: rgb(0.85, 0.95, 0.9),
  });
  layout.y = A4[1] - 220;

  layout.field("Chauffeur", fullName);
  layout.field("Identifiant interne", driverId);
  layout.field("Statut du dossier", VERIFICATION_LABELS[status] ?? status);
  layout.field("Date de transmission", frDateTime(data.driver?.submitted_at));
  layout.field("Dernière modification", frDateTime(data.driver?.updated_at));
  layout.field("Date de génération du PDF", frDateTime(generatedAt.toISOString()));
  layout.field("Avancement", `${data.state?.percent ?? 0} %`);
  layout.gap(10);
  layout.text("Synthèse des catégories", { size: 12, bold: true });
  layout.gap(4);
  for (const key of SECTION_ORDER) {
    const state = sectionStates.get(key) ?? "todo";
    layout.field(SECTION_LABELS[key], SECTION_STATE[state] ?? state);
  }

  /* --- Sections détaillées --- */
  for (const key of SECTION_ORDER) {
    layout.newPage();
    layout.heading(SECTION_LABELS[key]);

    const state = sectionStates.get(key) ?? "todo";
    layout.field("Statut de vérification", SECTION_STATE[state] ?? state);
    const review = reviews.get(key);
    if (review) {
      layout.field(
        "Décision administrative",
        `${review.status} — ${frDateTime(review.updated_at)}`,
      );
      if (review.note) layout.banner(`Commentaire administrateur : ${review.note}`);
    }
    layout.gap(6);

    for (const [label, value] of sectionFields(key, data)) layout.field(label, value);

    const expected = SECTION_DOCS[key];
    if (expected.length) {
      layout.gap(10);
      layout.text("Justificatifs", { size: 12, bold: true });
      layout.gap(4);

      for (const docType of expected) {
        const doc = data.documents.find((x) => x.doc_type === docType);
        const required = REQUIRED_DOCS[key].includes(docType);
        const label = DOCUMENT_LABELS[docType] ?? docType;

        if (!doc?.file_path) {
          layout.field(
            label,
            required ? "MANQUANT (pièce obligatoire)" : "Non transmis (facultatif)",
          );
          continue;
        }

        layout.field(
          label,
          `${DOC_STATUS[doc.status] ?? doc.status} — déposé le ${fr(doc.created_at)}${
            doc.expires_at ? ` — échéance ${fr(doc.expires_at)}` : ""
          }`,
        );
        if (doc.review_note) layout.banner(`Motif : ${doc.review_note}`, LIGHT, RED);

        const download = await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).download(doc.file_path);
        if (download.error || !download.data) {
          layout.banner("Fichier introuvable ou illisible dans le coffre sécurisé.", LIGHT, RED);
          continue;
        }
        const bytes = new Uint8Array(await download.data.arrayBuffer());
        const kind = detectKind(bytes);

        try {
          if (kind === "pdf") {
            const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
            const pages = await pdf.copyPages(src, src.getPageIndices());
            for (const p of pages) pdf.addPage(p);
            layout.banner(`Justificatif PDF intégré (${pages.length} page(s)) à la suite.`);
            layout.newPage();
          } else if (kind === "jpg" || kind === "png") {
            const image = kind === "jpg" ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
            const maxW = layout.width;
            const maxH = 380;
            const scale = Math.min(maxW / image.width, maxH / image.height, 1);
            const w = image.width * scale;
            const h = image.height * scale;
            layout.ensure(h + 14);
            layout.page.drawImage(image, {
              x: MARGIN,
              y: layout.y - h,
              width: w,
              height: h,
            });
            layout.y -= h + 12;
          } else {
            layout.banner(
              "Format d'image non intégrable dans le PDF (WebP ou autre) : le fichier d'origine est disponible dans l'archive ZIP.",
              LIGHT,
              RED,
            );
          }
        } catch {
          layout.banner("Justificatif illisible : intégration impossible.", LIGHT, RED);
        }
      }
    }
  }

  /* --- Récapitulatif administratif --- */
  layout.newPage();
  layout.heading("Récapitulatif administratif");

  const adminIds = [
    ...new Set(
      [
        data.driver?.approved_by,
        ...data.sectionReviews.map((r) => r.admin_id),
        ...data.documents.map((d) => d.reviewed_by),
      ].filter(Boolean) as string[],
    ),
  ];
  const admins = adminIds.length
    ? ((await supabaseAdmin.from("profiles").select("id, full_name").in("id", adminIds)).data ?? [])
    : [];
  const adminName = (id?: string | null) =>
    id ? (admins.find((a) => a.id === id)?.full_name ?? id) : "—";

  layout.field("Décision finale", VERIFICATION_LABELS[status] ?? status);
  layout.field(
    "Date de la décision",
    status === "verified"
      ? frDateTime(data.driver?.approved_at)
      : frDateTime(data.driver?.updated_at),
  );
  layout.field("Administrateur ayant contrôlé", adminName(data.driver?.approved_by));
  layout.field("Motif de refus / correction", val(data.driver?.rejection_reason));
  layout.field("Motif de suspension", val(data.driver?.suspension_reason));
  layout.gap(10);

  layout.text("Historique des contrôles par catégorie", { size: 12, bold: true });
  layout.gap(4);
  if (!data.sectionReviews.length) {
    layout.text("Aucune décision enregistrée par catégorie.", { color: GREY });
  } else {
    for (const r of data.sectionReviews) {
      layout.field(
        SECTION_LABELS[r.section as SectionKey] ?? r.section,
        `${r.status} — ${frDateTime(r.updated_at)} — ${adminName(r.admin_id)}${
          r.note ? ` — ${r.note}` : ""
        }`,
      );
    }
  }

  layout.gap(10);
  layout.text("Historique des corrections demandées sur les pièces", { size: 12, bold: true });
  layout.gap(4);
  const rejected = data.documents.filter((d) => d.review_note);
  if (!rejected.length) {
    layout.text("Aucune correction demandée.", { color: GREY });
  } else {
    for (const d of rejected) {
      layout.field(
        DOCUMENT_LABELS[d.doc_type] ?? d.doc_type,
        `${DOC_STATUS[d.status] ?? d.status} — ${frDateTime(d.reviewed_at)} — ${adminName(
          d.reviewed_by,
        )} — ${d.review_note}`,
      );
    }
  }

  layout.gap(10);
  layout.text("Remarques internes", { size: 12, bold: true });
  layout.gap(4);
  if (!data.notes.length) {
    layout.text("Aucune remarque interne.", { color: GREY });
  } else {
    for (const n of data.notes) {
      layout.field(frDateTime(n.created_at), `${n.author} : ${n.note}`);
    }
  }

  const bytes = await pdf.save();

  const slug = (fullName || "chauffeur")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
  const stamp = generatedAt.toISOString().slice(0, 10).split("-").reverse().join("-");
  const fileName = `ReLink_Dossier_Chauffeur_${slug || "CHAUFFEUR"}_${stamp}.pdf`;

  return { bytes, fileName };
}
