import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  Eye,
  FileDown,
  Loader2,
  Lock,
  PenLine,
  ShieldCheck,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  confirmAdminReauth,
  exportDossierArchive,
  generateDossierPdf,
  getDriverDossier,
} from "@/lib/admin-dossier.functions";
import {
  DOCUMENT_LABELS,
  DOC_STATUS_LABELS,
  VERIFICATION_LABELS,
  formatDate,
  formatDateTime,
} from "@/lib/labels";
import { SECTION_STATE_LABELS, type SectionState } from "@/lib/driver-dossier";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/Ui";
import { DocumentViewer, type ReviewDocument } from "@/components/admin/DocumentViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Pièces attendues pour chacune des sept catégories du dossier. */
const SECTION_DOCS: Record<string, string[]> = {
  identity: ["identity", "identity_back", "driver_photo"],
  license: ["driving_license", "driving_license_back", "adcs"],
  vtc: ["vtc_card", "vtc_card_back", "revtc_proof"],
  company: ["company_proof", "rne_kbis"],
  insurance: ["insurance_rc", "insurance"],
  vehicle: ["registration", "inspection", "vehicle_ownership"],
  tax: [],
};

const REQUIRED_DOCS: Record<string, string[]> = {
  identity: ["identity"],
  license: ["driving_license"],
  vtc: ["vtc_card"],
  company: ["company_proof"],
  insurance: ["insurance"],
  vehicle: ["registration", "inspection"],
  tax: [],
};

const SECTION_REVIEW_LABELS: Record<string, string> = {
  approved: "Validée par l'administration",
  rejected: "Refusée",
  changes_requested: "Correction demandée",
};

type Dossier = Awaited<ReturnType<typeof getDriverDossier>>;

function Field({ label, value }: { label: string; value?: string | number | null | undefined }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm break-words">
        {value === null || value === undefined || value === "" ? "—" : String(value)}
      </p>
    </div>
  );
}

function sectionFields(key: string, d: Dossier) {
  const det = d.details;
  const v = d.vehicles[0];
  switch (key) {
    case "identity":
      return [
        ["Nom et prénom", d.profile?.full_name],
        ["Date de naissance", formatDate(det?.birth_date)],
        ["Adresse postale", det?.postal_address],
        ["Type de pièce", det?.id_doc_type],
        ["Expiration de la pièce", formatDate(det?.id_doc_expires_on)],
        ["E-mail", d.profile?.email],
        ["Téléphone", d.profile?.phone],
      ] as const;
    case "license":
      return [
        ["Numéro de permis", det?.license_number],
        ["Catégories", det?.license_categories],
        ["Délivré le", formatDate(det?.license_issued_on)],
        ["Valable jusqu'au", formatDate(det?.license_expires_on)],
      ] as const;
    case "vtc":
      return [
        ["Numéro de carte VTC", d.driver?.vtc_card_number],
        ["Autorité de délivrance", det?.vtc_authority],
        ["Délivrée le", formatDate(det?.vtc_issued_on)],
        ["Expire le", formatDate(det?.vtc_expires_on)],
        ["Numéro REVTC", det?.revtc_number],
      ] as const;
    case "company":
      return [
        ["Raison sociale", d.company?.legal_name],
        ["Forme juridique", d.company?.legal_form],
        ["Nom commercial", det?.trade_name ?? d.driver?.business_name],
        ["SIREN", det?.siren],
        ["SIRET", d.company?.siret ?? d.driver?.siret],
        [
          "Adresse de l'entreprise",
          [d.company?.address, d.company?.postal_code, d.company?.city].filter(Boolean).join(" "),
        ],
        ["TVA intracommunautaire", d.company?.vat_number],
      ] as const;
    case "insurance":
      return [
        ["RC pro — assureur", det?.rc_company],
        ["RC pro — contrat", det?.rc_contract],
        ["RC pro — début", formatDate(det?.rc_starts_on)],
        ["RC pro — échéance", formatDate(det?.rc_expires_on)],
        ["Auto VTC — assureur", det?.auto_company],
        ["Auto VTC — contrat", det?.auto_contract],
        ["Auto VTC — début", formatDate(det?.auto_starts_on)],
        ["Auto VTC — échéance", formatDate(det?.auto_expires_on)],
        ["Plaque assurée", det?.auto_plate],
      ] as const;
    case "vehicle":
      return [
        ["Marque et modèle", [v?.brand, v?.model].filter(Boolean).join(" ")],
        ["Immatriculation", v?.plate],
        ["Année", v?.year],
        ["Couleur", v?.color],
        ["Catégorie", v?.category],
        ["Passagers / bagages", v ? `${v.max_passengers} / ${v.luggage_capacity}` : null],
        ["Titulaire de la carte grise", det?.registration_holder],
        ["Contrôle technique", formatDate(v?.inspection_expires_at)],
        ["Assurance véhicule", formatDate(v?.insurance_expires_at)],
      ] as const;
    case "tax":
      return [
        [
          "Régime de TVA",
          d.tax?.regime === "liable"
            ? "Redevable"
            : d.tax?.regime === "franchise"
              ? "Franchise en base"
              : null,
        ],
        ["Taux", d.tax?.rate_label ?? (d.tax?.vat_rate != null ? `${d.tax.vat_rate} %` : null)],
        ["Numéro de TVA", d.tax?.vat_number ?? d.company?.vat_number],
        ["Applicable depuis", formatDate(d.tax?.effective_from)],
        ["Tarif au km HT", d.tariffs[0]?.price_per_km_ht],
        ["Minimum de course HT", d.tariffs[0]?.minimum_ht],
        ["Mention légale", d.tax?.legal_mention],
      ] as const;
    default:
      return [] as const;
  }
}

export function DossierReview({ driverId }: { driverId: string }) {
  const qc = useQueryClient();
  const load = useServerFn(getDriverDossier);
  const runExport = useServerFn(exportDossierArchive);
  const runPdf = useServerFn(generateDossierPdf);
  const reauth = useServerFn(confirmAdminReauth);

  const [viewer, setViewer] = useState<ReviewDocument | null>(null);
  const [docNotes, setDocNotes] = useState<Record<string, string>>({});
  const [sectionNotes, setSectionNotes] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [tab, setTab] = useState<string>("identity");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "dossier", driverId],
    queryFn: () => load({ data: { driverId } }),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["admin"] });

  const reviewDoc = useMutation({
    mutationFn: async (v: { id: string; decision: "approved" | "rejected"; note?: string }) => {
      const { error: e } = await supabase.rpc("admin_review_document", {
        _document: v.id,
        _decision: v.decision,
        _note: v.note ?? "",
      });
      if (e) throw e;
    },
    onSuccess: () => {
      toast.success("Pièce mise à jour");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const reviewSection = useMutation({
    mutationFn: async (v: { section: string; decision: "approve" | "reject" | "changes" }) => {
      const { error: e } = await supabase.rpc("admin_review_section", {
        _driver: driverId,
        _section: v.section,
        _decision: v.decision,
        _note: sectionNotes[v.section] ?? "",
      } as never);
      if (e) throw e;
    },
    onSuccess: () => {
      toast.success("Décision enregistrée pour la catégorie");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Décision impossible"),
  });

  const addNote = useMutation({
    mutationFn: async (text: string) => {
      const { data: me } = await supabase.auth.getUser();
      const { error: e } = await supabase
        .from("dossier_admin_notes")
        .insert({ driver_id: driverId, admin_id: me.user!.id, note: text });
      if (e) throw e;
    },
    onSuccess: () => {
      setNote("");
      toast.success("Note interne enregistrée");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const decide = useMutation({
    mutationFn: async (decision: "approve" | "changes" | "reject" | "suspend" | "reinstate") => {
      if (decision !== "approve" && decision !== "reinstate" && !reason.trim()) {
        throw new Error("Un motif est obligatoire");
      }
      const { error: e } = await supabase.rpc("admin_decide_driver", {
        _driver: driverId,
        _decision: decision === "changes" ? "request_changes" : decision,
        _reason: reason,
      });
      if (e) throw e;
    },
    onSuccess: () => {
      toast.success("Décision enregistrée");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const exportZip = useMutation({
    mutationFn: async () => {
      await reauth({ data: { password } });
      return runExport({ data: { driverId, reason: reason || undefined } });
    },
    onSuccess: (r) => {
      setPassword("");
      setExportOpen(false);
      window.open(r.url, "_blank", "noopener,noreferrer");
      toast.success(`Archive générée (${r.files} pièces) — lien valable 10 minutes`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Export impossible"),
  });

  const pdf = useMutation({
    mutationFn: () => runPdf({ data: { driverId } }),
    onSuccess: (r) => {
      const bin = atob(r.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = r.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success("Dossier PDF généré");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Génération impossible"),
  });

  const docsBySection = useMemo(() => {
    const map = new Map<string, Dossier["documents"]>();
    for (const [key, types] of Object.entries(SECTION_DOCS)) {
      map.set(
        key,
        (data?.documents ?? []).filter((d) => types.includes(d.doc_type)),
      );
    }
    return map;
  }, [data?.documents]);

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    return <p className="text-sm text-destructive">Dossier indisponible ou accès refusé.</p>;
  }

  const state = data.state;
  const sections = state?.sections ?? [];
  const allSectionsValidated =
    sections.length > 0 &&
    sections.every((s) => data.sectionReviews.find((r) => r.section === s.key)?.status === "approved");

  const renderSection = (s: { key: string; label: string; state: string }) => {
    const docs = docsBySection.get(s.key) ?? [];
    const expected = SECTION_DOCS[s.key] ?? [];
    const missing = expected.filter((t) => !docs.some((d) => d.doc_type === t && d.file_path));
    const review = data.sectionReviews.find((r) => r.section === s.key);

    return (
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {sectionFields(s.key, data).map(([label, value]) => (
            <Field key={label} label={label} value={value as string | number | null | undefined} />
          ))}
        </div>

        {docs.length ? (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div key={doc.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium">
                      {DOCUMENT_LABELS[doc.doc_type] ?? doc.doc_type}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      · déposé le {formatDate(doc.created_at)} · échéance {formatDate(doc.expires_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={doc.status} labels={DOC_STATUS_LABELS} />
                    <Button size="sm" variant="outline" onClick={() => setViewer(doc)}>
                      <Eye className="size-4" /> Consulter
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Motif transmis au chauffeur"
                    value={docNotes[doc.id] ?? ""}
                    onChange={(e) => setDocNotes((n) => ({ ...n, [doc.id]: e.target.value }))}
                    className="h-9 max-w-xs"
                  />
                  <Button size="sm" onClick={() => reviewDoc.mutate({ id: doc.id, decision: "approved" })}>
                    <Check className="size-4" /> Valider
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() =>
                      docNotes[doc.id]
                        ? reviewDoc.mutate({
                            id: doc.id,
                            decision: "rejected",
                            note: docNotes[doc.id] as string,
                          })
                        : toast.error("Indiquez le motif du refus")
                    }
                  >
                    <X className="size-4" /> Refuser
                  </Button>
                </div>
                {doc.review_note ? (
                  <p className="mt-2 text-xs text-muted-foreground">Motif actuel : {doc.review_note}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {missing.length ? (
          <div className="space-y-1.5">
            {missing.map((type) => {
              const required = (REQUIRED_DOCS[s.key] ?? []).includes(type);
              return (
                <div
                  key={type}
                  className={`flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm ${
                    required ? "border-destructive/50 text-destructive" : "border-border text-muted-foreground"
                  }`}
                >
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>
                    {DOCUMENT_LABELS[type] ?? type} —{" "}
                    {required ? "manquant (obligatoire)" : "non transmis (facultatif)"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}

        {!expected.length && !docs.length ? (
          <p className="text-sm text-muted-foreground">
            Cette catégorie ne comporte pas de justificatif à joindre.
          </p>
        ) : null}

        <div className="space-y-2 rounded-xl bg-muted/40 p-3">
          <p className="text-sm font-medium">Décision sur la catégorie</p>
          {review ? (
            <p className="text-xs text-muted-foreground">
              {SECTION_REVIEW_LABELS[review.status] ?? review.status} ·{" "}
              {formatDateTime(review.updated_at)}
              {review.note ? ` · ${review.note}` : ""}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Aucune décision enregistrée.</p>
          )}
          <Input
            placeholder="Motif (obligatoire pour un refus ou une correction)"
            value={sectionNotes[s.key] ?? ""}
            onChange={(e) => setSectionNotes((n) => ({ ...n, [s.key]: e.target.value }))}
            className="h-9 max-w-md"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={s.state !== "approved" || reviewSection.isPending}
              title={
                s.state === "approved" ? undefined : "Toutes les pièces obligatoires doivent être validées"
              }
              onClick={() => reviewSection.mutate({ section: s.key, decision: "approve" })}
            >
              <ShieldCheck className="size-4" /> Valider
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                sectionNotes[s.key]?.trim()
                  ? reviewSection.mutate({ section: s.key, decision: "changes" })
                  : toast.error("Indiquez le motif de la correction demandée")
              }
            >
              <PenLine className="size-4" /> Demander une correction
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() =>
                sectionNotes[s.key]?.trim()
                  ? reviewSection.mutate({ section: s.key, decision: "reject" })
                  : toast.error("Indiquez le motif du refus")
              }
            >
              <X className="size-4" /> Refuser
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const stateColor = (value: string) =>
    value === "approved" ? "text-primary" : value === "todo" ? "text-muted-foreground" : "text-destructive";

  return (
    <div className="pb-16">
      <Link
        to="/admin/chauffeurs"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Retour aux dossiers
      </Link>

      <PageHeader
        title={data.profile?.full_name || data.driver?.business_name || "Dossier chauffeur"}
        description={`${data.profile?.email ?? "—"} · ${data.profile?.phone ?? "—"} · dossier complété à ${state?.percent ?? 0} %`}
      />

      <div className="surface mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={data.driver?.verification_status ?? "incomplete"}
              labels={VERIFICATION_LABELS}
            />
            <span className="text-xs text-muted-foreground">
              Transmis le {formatDateTime(data.driver?.submitted_at)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Dernière modification : {formatDateTime(data.driver?.updated_at)} · dossier {driverId.slice(0, 8)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pdf.isPending} onClick={() => pdf.mutate()}>
            {pdf.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileDown className="size-4" />
            )}
            Télécharger le dossier complet en PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
            <Download className="size-4" /> Télécharger les documents originaux
          </Button>
        </div>
      </div>

      {/* Mobile : accordéons */}
      <Accordion type="multiple" className="space-y-3 md:hidden">
        {sections.map((s) => (
          <AccordionItem key={s.key} value={s.key} className="surface border-none px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex w-full items-center justify-between gap-3 pr-2">
                <span className="text-sm font-medium">{s.label}</span>
                <span className={`text-xs ${stateColor(s.state)}`}>
                  {SECTION_STATE_LABELS[s.state as SectionState] ?? s.state}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">{renderSection(s)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Ordinateur : navigation latérale */}
      <div className="hidden gap-4 md:grid md:grid-cols-[220px_1fr]">
        <nav className="surface h-fit space-y-1 p-2">
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setTab(s.key)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                tab === s.key ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
              }`}
            >
              <span className="block">{s.label}</span>
              <span className={`text-[11px] ${stateColor(s.state)}`}>
                {SECTION_STATE_LABELS[s.state as SectionState] ?? s.state}
              </span>
            </button>
          ))}
        </nav>
        <div className="surface p-4">
          {sections
            .filter((s) => s.key === tab)
            .map((s) => (
              <div key={s.key} className="space-y-4">
                <h2 className="text-base font-semibold">{s.label}</h2>
                {renderSection(s)}
              </div>
            ))}
        </div>
      </div>

      <div className="surface mt-4 space-y-3 p-4">
        <p className="text-sm font-medium">Notes internes (jamais visibles par le chauffeur)</p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Observation réservée à l'équipe de modération"
          rows={3}
        />
        <Button size="sm" disabled={!note.trim()} onClick={() => addNote.mutate(note.trim())}>
          Enregistrer la note
        </Button>
        <div className="space-y-2">
          {data.notes.map((n) => (
            <div key={n.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <p>{n.note}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.author} · {formatDateTime(n.created_at)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="surface mt-4 space-y-3 p-4">
        <p className="text-sm font-medium">Décision sur le compte</p>
        <Input
          placeholder="Motif communiqué au chauffeur"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="max-w-md"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!state?.all_approved || !allSectionsValidated}
            title={
              !state?.all_approved
                ? "Toutes les pièces obligatoires doivent être validées"
                : !allSectionsValidated
                  ? "Chaque catégorie doit être validée avant l'approbation finale"
                  : undefined
            }
            onClick={() => decide.mutate("approve")}
          >
            Valider le dossier chauffeur
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide.mutate("changes")}>
            Demander une correction
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => decide.mutate("reject")}>
            Refuser
          </Button>
          <Button size="sm" variant="ghost" onClick={() => decide.mutate("suspend")}>
            Suspendre
          </Button>
          {data.driver?.verification_status === "suspended" ? (
            <Button size="sm" variant="outline" onClick={() => decide.mutate("reinstate")}>
              Réactiver
            </Button>
          ) : null}
        </div>
        {!allSectionsValidated ? (
          <p className="text-xs text-muted-foreground">
            Les sept catégories doivent être contrôlées et validées une à une avant l'approbation finale.
          </p>
        ) : null}
      </div>

      <DocumentViewer document={viewer} open={!!viewer} onOpenChange={(v) => !v && setViewer(null)} />

      <AlertDialog open={exportOpen} onOpenChange={setExportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="size-4" /> Télécharger les documents originaux
            </AlertDialogTitle>
            <AlertDialogDescription>
              L'archive contient des données personnelles sensibles. Le téléchargement est journalisé et
              nominatif. Confirmez votre mot de passe administrateur pour continuer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Mot de passe administrateur"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPassword("")}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={!password || exportZip.isPending}
              onClick={(e) => {
                e.preventDefault();
                exportZip.mutate();
              }}
            >
              {exportZip.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Générer et télécharger
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
