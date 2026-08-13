import { zipSync, strToU8 } from "fflate";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const DOCUMENTS_BUCKET = "documents";
export const EXPORTS_BUCKET = "dossier-exports";
/** Durée de vie volontairement courte des URL signées administratives. */
export const SIGNED_URL_TTL = 300;
export const EXPORT_URL_TTL = 600;
/** Fenêtre pendant laquelle une réauthentification renforcée reste valable. */
export const REAUTH_WINDOW_MINUTES = 10;

export const SECTION_ORDER = [
  "identity",
  "license",
  "vtc",
  "company",
  "insurance",
  "vehicle",
  "tax",
] as const;

export type SectionKey = (typeof SECTION_ORDER)[number];

export type DossierStateJson = {
  percent: number;
  status: string;
  all_approved: boolean;
  sections: { key: string; label: string; state: string }[];
};

export const SECTION_LABELS: Record<SectionKey, string> = {
  identity: "Identité",
  license: "Permis",
  vtc: "Carte professionnelle VTC",
  company: "Entreprise",
  insurance: "Assurances",
  vehicle: "Véhicule",
  tax: "Fiscalité",
};

/** Documents rattachés à chaque section (obligatoires en premier). */
export const SECTION_DOCS: Record<SectionKey, string[]> = {
  identity: ["identity", "identity_back", "driver_photo"],
  license: ["driving_license", "driving_license_back", "adcs"],
  vtc: ["vtc_card", "vtc_card_back", "revtc_proof"],
  company: ["company_proof", "rne_kbis"],
  insurance: ["insurance_rc", "insurance"],
  vehicle: ["registration", "inspection", "vehicle_ownership"],
  tax: [],
};

export const REQUIRED_DOCS: Record<SectionKey, string[]> = {
  identity: ["identity"],
  license: ["driving_license"],
  vtc: ["vtc_card"],
  company: ["company_proof"],
  insurance: ["insurance"],
  vehicle: ["registration", "inspection"],
  tax: [],
};

const ARCHIVE_FOLDERS: Record<SectionKey, string> = {
  identity: "01-identite",
  license: "02-permis",
  vtc: "03-carte-vtc",
  company: "04-entreprise",
  insurance: "05-assurances",
  vehicle: "06-vehicule",
  tax: "07-fiscalite",
};

const ARCHIVE_FILE_NAMES: Record<string, string> = {
  identity: "piece-identite-recto",
  identity_back: "piece-identite-verso",
  driver_photo: "photo-chauffeur",
  driving_license: "permis-recto",
  driving_license_back: "permis-verso",
  adcs: "adcs",
  vtc_card: "carte-vtc-recto",
  vtc_card_back: "carte-vtc-verso",
  revtc_proof: "justificatif-revtc",
  company_proof: "justificatif-entreprise",
  rne_kbis: "justificatif-rne-ou-kbis",
  insurance_rc: "responsabilite-civile-professionnelle",
  insurance: "assurance-automobile-vtc",
  registration: "carte-grise",
  inspection: "controle-technique",
  vehicle_ownership: "justificatif-utilisation",
  other: "autre-justificatif",
};

export function sectionOfDocType(docType: string): SectionKey | null {
  for (const key of SECTION_ORDER) {
    if (SECTION_DOCS[key].includes(docType)) return key;
  }
  return null;
}

/** Contrôle du rôle administrateur côté serveur, jamais côté navigateur. */
export async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error("Vérification du rôle impossible");
  const roles = (data ?? []).map((r) => r.role as string);
  if (!roles.includes("admin") && !roles.includes("superadmin")) {
    throw new Error("Accès réservé aux administrateurs");
  }
  return roles;
}

export async function logAdminAction(
  actorId: string,
  action: string,
  resource: string,
  resourceId: string,
  value?: Record<string, unknown>,
) {
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    resource,
    resource_id: resourceId,
    new_value: (value ?? {}) as never,
  } as never);
}

export async function hasRecentReauth(adminId: string) {
  const since = new Date(Date.now() - REAUTH_WINDOW_MINUTES * 60_000).toISOString();
  const { data } = await supabaseAdmin
    .from("admin_reauth_events")
    .select("verified_at")
    .eq("admin_id", adminId)
    .gte("verified_at", since)
    .order("verified_at", { ascending: false })
    .limit(1);
  return !!data?.length;
}

/* ------------------------------------------------------------------ */
/* Lecture complète d'un dossier (données du chauffeur concerné seul).  */
/* ------------------------------------------------------------------ */

export async function loadDossier(driverId: string) {
  const [profile, driver, company, vehicles, details, docs, reviews, sections, tax, tariffs] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", driverId).maybeSingle(),
      supabaseAdmin.from("driver_profiles").select("*").eq("user_id", driverId).maybeSingle(),
      supabaseAdmin.from("companies").select("*").eq("driver_id", driverId).order("created_at").limit(1),
      supabaseAdmin.from("vehicles").select("*").eq("driver_id", driverId).order("is_primary", { ascending: false }),
      supabaseAdmin.from("driver_dossier_details").select("*").eq("driver_id", driverId).maybeSingle(),
      supabaseAdmin
        .from("verification_documents")
        .select("*")
        .eq("driver_id", driverId)
        .order("updated_at", { ascending: false }),
      supabaseAdmin.from("dossier_admin_notes").select("*").eq("driver_id", driverId).order("created_at", { ascending: false }),
      supabaseAdmin.from("dossier_section_reviews").select("*").eq("driver_id", driverId),
      supabaseAdmin.from("driver_tax_profiles").select("*").eq("driver_id", driverId).maybeSingle(),
      supabaseAdmin.from("driver_tariffs").select("*").eq("driver_id", driverId),
    ]);

  const noteAuthors = [...new Set((reviews.data ?? []).map((n) => n.admin_id).filter(Boolean))] as string[];
  const authors = noteAuthors.length
    ? (await supabaseAdmin.from("profiles").select("id, full_name").in("id", noteAuthors)).data ?? []
    : [];

  const state = await supabaseAdmin.rpc("driver_dossier_state", { _driver: driverId });

  return {
    profile: profile.data ?? null,
    driver: driver.data ?? null,
    company: company.data?.[0] ?? null,
    vehicles: vehicles.data ?? [],
    details: details.data ?? null,
    documents: docs.data ?? [],
    notes: (reviews.data ?? []).map((n) => ({
      ...n,
      author: authors.find((a) => a.id === n.admin_id)?.full_name ?? "Administrateur",
    })),
    sectionReviews: sections.data ?? [],
    tax: tax.data ?? null,
    tariffs: tariffs.data ?? [],
    state: (state.data ?? null) as DossierStateJson | null,
  };
}

/* ------------------------------------------------------------------ */
/* Générateur PDF minimal (texte), sans dépendance navigateur.          */
/* ------------------------------------------------------------------ */

function pdfEscape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

const TYPOGRAPHIC: Record<string, string> = {
  "\u2014": "-",
  "\u2013": "-",
  "\u2019": "'",
  "\u2018": "'",
  "\u201c": '"',
  "\u201d": '"',
  "\u2026": "...",
  "\u00a0": " ",
  "\u20ac": "EUR",
};

function normalizeText(text: string) {
  return text.replace(/[\u2013\u2014\u2018\u2019\u201c\u201d\u2026\u00a0\u20ac]/g, (c) => TYPOGRAPHIC[c] ?? c);
}

function latin1(text: string) {
  const normalized = text;
  const out = new Uint8Array(normalized.length);
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    out[i] = code < 256 ? code : 63; // "?" pour les caractères hors WinAnsi
  }
  return out;
}

export function buildTextPdf(title: string, lines: string[]): Uint8Array {
  const perPage = 48;
  const pages: string[][] = [];
  const all = [title, "", ...lines].map(normalizeText);
  for (let i = 0; i < all.length; i += perPage) pages.push(all.slice(i, i + perPage));
  if (!pages.length) pages.push([title]);

  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  pages.forEach((pageLines, index) => {
    const id = pageIds[index]!;
    const contentId = id + 1;
    let y = 800;
    let stream = "BT\n/F1 10 Tf\n12 TL\n";
    stream += `1 0 0 1 48 ${y} Tm\n`;
    pageLines.forEach((line, i) => {
      const size = index === 0 && i === 0 ? 15 : line.startsWith("== ") ? 12 : 10;
      stream += `/F1 ${size} Tf\n(${pdfEscape(line.replace(/^== /, ""))}) Tj\nT*\n`;
      y -= 14;
    });
    stream += "ET";
    objects[id] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    const body = objects[i];
    if (!body) continue;
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${body}\nendobj\n`;
  }
  const xrefPos = pdf.length;
  const count = objects.length;
  pdf += `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let i = 1; i < count; i++) {
    pdf += `${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return latin1(pdf);
}

async function sha256(bytes: Uint8Array) {
  const view = new Uint8Array(bytes).slice().buffer;
  const digest = await crypto.subtle.digest("SHA-256", view);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function extensionOf(path: string, fallback = "bin") {
  const clean = path.split("?")[0] ?? path;
  const ext = clean.includes(".") ? clean.split(".").pop() : undefined;
  return (ext ?? fallback).toLowerCase().slice(0, 5);
}

function fr(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("fr-FR");
}

/* ------------------------------------------------------------------ */
/* Archive ZIP structurée                                              */
/* ------------------------------------------------------------------ */

export async function buildDossierArchive(driverId: string) {
  const data = await loadDossier(driverId);
  const state = (data.state ?? {}) as {
    percent?: number;
    status?: string;
    sections?: { key: string; label: string; state: string }[];
  };
  const generatedAt = new Date();
  const files: Record<string, Uint8Array> = {};
  const manifestFiles: Record<string, unknown>[] = [];
  const root = `dossier-chauffeur-${driverId.slice(0, 8)}`;

  for (const doc of data.documents) {
    if (!doc.file_path) continue;
    const section = sectionOfDocType(doc.doc_type);
    if (!section) continue;
    const download = await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).download(doc.file_path);
    if (download.error || !download.data) continue;
    const bytes = new Uint8Array(await download.data.arrayBuffer());
    const name = `${ARCHIVE_FILE_NAMES[doc.doc_type] ?? doc.doc_type}.${extensionOf(doc.file_path)}`;
    const entry = `${root}/${ARCHIVE_FOLDERS[section]}/${name}`;
    files[entry] = bytes; // fichier original, non altéré
    manifestFiles.push({
      path: `${ARCHIVE_FOLDERS[section]}/${name}`,
      section,
      doc_type: doc.doc_type,
      uploaded_at: doc.created_at,
      expires_at: doc.expires_at,
      status: doc.status,
      bytes: bytes.byteLength,
      sha256: await sha256(bytes),
    });
  }

  // Synthèse PDF
  const d = data.details;
  const lines: string[] = [
    `Identifiant interne du dossier : ${driverId}`,
    `Export généré le ${generatedAt.toLocaleString("fr-FR")}`,
    "Document de synthèse interne — ne constitue pas une certification officielle.",
    "",
    "== Identité déclarée",
    `Nom : ${data.profile?.full_name ?? "—"}`,
    `Date de naissance : ${fr(d?.birth_date)}`,
    `Adresse : ${d?.postal_address ?? "—"}`,
    `E-mail : ${data.profile?.email ?? "—"}`,
    `Téléphone : ${data.profile?.phone ?? "—"}`,
    "",
    "== Informations professionnelles",
    `Nom commercial : ${data.driver?.business_name ?? "—"}`,
    `Carte VTC : ${data.driver?.vtc_card_number ?? "—"} (expire le ${fr(d?.vtc_expires_on)})`,
    `Permis : ${d?.license_number ?? "—"} — catégories ${d?.license_categories ?? "—"}`,
    `Entreprise : ${data.company?.legal_name ?? "—"} (${data.company?.legal_form ?? "—"})`,
    `SIRET : ${data.company?.siret ?? "—"} — SIREN : ${d?.siren ?? "—"}`,
    `Adresse entreprise : ${data.company?.address ?? "—"} ${data.company?.postal_code ?? ""} ${data.company?.city ?? ""}`,
    "",
    "== Assurances",
    `RC professionnelle : ${d?.rc_company ?? "—"} — contrat ${d?.rc_contract ?? "—"} (échéance ${fr(d?.rc_expires_on)})`,
    `Assurance automobile VTC : ${d?.auto_company ?? "—"} — contrat ${d?.auto_contract ?? "—"} (échéance ${fr(d?.auto_expires_on)})`,
    "",
    "== Véhicule",
    ...(data.vehicles.length
      ? data.vehicles.map(
          (v) =>
            `${v.brand ?? "—"} ${v.model ?? ""} — ${v.plate ?? "—"} — contrôle technique ${fr(v.inspection_expires_at)}`,
        )
      : ["Aucun véhicule enregistré"]),
    "",
    "== Fiscalité",
    `Régime TVA : ${data.tax?.regime ?? "—"} ${data.tax?.rate_label ?? ""}`,
    `Numéro de TVA : ${data.company?.vat_number ?? "—"}`,
    "",
    "== Statut des sections",
    ...(state.sections ?? []).map((s) => `${s.label} : ${s.state}`),
    "",
    "== Documents présents dans l'archive",
    ...(manifestFiles.length
      ? manifestFiles.map(
          (f) => `${f["path"]} — statut ${f["status"]} — échéance ${fr(f["expires_at"] as string | null)}`,
        )
      : ["Aucun document déposé"]),
    "",
    "== Corrections et réserves",
    ...(data.documents
      .filter((doc) => doc.review_note)
      .map((doc) => `${doc.doc_type} : ${doc.review_note}`) ?? []),
  ];

  files[`${root}/00-recapitulatif/synthese-dossier.pdf`] = buildTextPdf(
    "Synthèse du dossier chauffeur ReLink",
    lines,
  );

  const manifest = {
    dossier_id: driverId,
    generated_at: generatedAt.toISOString(),
    export_format_version: "1.0",
    global_status: state.status ?? null,
    progress_percent: state.percent ?? null,
    sections: (state.sections ?? []).map((s) => ({ key: s.key, label: s.label, state: s.state })),
    files: manifestFiles,
  };
  files[`${root}/00-recapitulatif/manifeste.json`] = strToU8(JSON.stringify(manifest, null, 2));

  const zipped = zipSync(files, { level: 6 });
  const stamp = generatedAt.toISOString().slice(0, 10);
  const fileName = `dossier-chauffeur-${driverId.slice(0, 8)}-${stamp}.zip`;
  return { zipped, fileName, count: manifestFiles.length };
}

/** Purge des archives temporaires devenues inutiles (plus d'une heure). */
export async function cleanupOldExports() {
  const { data } = await supabaseAdmin.storage.from(EXPORTS_BUCKET).list("", { limit: 100 });
  const stale = (data ?? []).filter(
    (f) => Date.now() - new Date(f.created_at ?? Date.now()).getTime() > 60 * 60 * 1000,
  );
  for (const folder of data ?? []) {
    const inner = await supabaseAdmin.storage.from(EXPORTS_BUCKET).list(folder.name, { limit: 100 });
    const old = (inner.data ?? [])
      .filter((f) => Date.now() - new Date(f.created_at ?? Date.now()).getTime() > 60 * 60 * 1000)
      .map((f) => `${folder.name}/${f.name}`);
    if (old.length) await supabaseAdmin.storage.from(EXPORTS_BUCKET).remove(old);
  }
  if (stale.length) {
    await supabaseAdmin.storage.from(EXPORTS_BUCKET).remove(stale.map((f) => f.name));
  }
}
