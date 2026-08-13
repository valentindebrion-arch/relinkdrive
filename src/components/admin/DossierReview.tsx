import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  Loader2,
  Lock,
  ShieldCheck,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  confirmAdminReauth,
  exportDossierArchive,
  getDriverDossier,
} from "@/lib/admin-dossier.functions";
import { DOCUMENT_LABELS, DOC_STATUS_LABELS, VERIFICATION_LABELS, formatDate, formatDateTime } from "@/lib/labels";
import { SECTION_STATE_LABELS, type SectionState } from "@/lib/driver-dossier";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/Ui";
import { DocumentViewer, type ReviewDocument } from "@/components/admin/DocumentViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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

const SECTION_DOCS: Record<string, string[]> = {
  identity: ["identity", "identity_back", "driver_photo"],
  license: ["driving_license", "driving_license_back", "adcs"],
  vtc: ["vtc_card", "vtc_card_back", "revtc_proof"],
  company: ["company_proof", "rne_kbis"],
  insurance: ["insurance_rc", "insurance"],
  vehicle: ["registration", "inspection", "vehicle_ownership"],
  tax: [],
};

type Dossier = Awaited<ReturnType<typeof getDriverDossier>>;

function Field({ label, value }: { label: string; value?: string | number | null | undefined }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value === null || value === undefined || value === "" ? "—" : String(value)}</p>
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
        ["Dénomination", d.company?.legal_name],
        ["Forme juridique", d.company?.legal_form],
        ["Nom commercial", det?.trade_name ?? d.driver?.business_name],
        ["SIREN", det?.siren],
        ["SIRET", d.company?.siret ?? d.driver?.siret],
        ["Adresse", [d.company?.address, d.company?.postal_code, d.company?.city].filter(Boolean).join(" ")],
      ] as const;
    case "insurance":
      return [
        ["RC pro — assureur", det?.rc_company],
        ["RC pro — contrat", det?.rc_contract],
        ["RC pro — échéance", formatDate(det?.rc_expires_on)],
        ["Auto VTC — assureur", det?.auto_company],
        ["Auto VTC — contrat", det?.auto_contract],
        ["Auto VTC — échéance", formatDate(det?.auto_expires_on)],
        ["Plaque assurée", det?.auto_plate],
      ] as const;
    case "vehicle":
      return [
        ["Marque et modèle", [v?.brand, v?.model].filter(Boolean).join(" ")],
        ["Immatriculation", v?.plate],
        ["Année", v?.year],
        ["Titulaire de la carte grise", det?.registration_holder],
        ["Contrôle technique", formatDate(v?.inspection_expires_at)],
        ["Assurance véhicule", formatDate(v?.insurance_expires_at)],
      ] as const;
    case "tax":
      return [
        ["Régime TVA", d.tax?.regime],
        ["Taux", d.tax?.rate_label],
        ["Numéro de TVA", d.tax?.vat_number ?? d.company?.vat_number],
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
  const reauth = useServerFn(confirmAdminReauth);

  const [viewer, setViewer] = useState<ReviewDocument | null>(null);
  const [docNotes, setDocNotes] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

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

  const validateSection = useMutation({
    mutationFn: async (section: string) => {
      const { error: e } = await supabase.rpc("admin_validate_section", {
        _driver: driverId,
        _section: section,
        _note: note || undefined,
      } as never);
      if (e) throw e;
    },
    onSuccess: () => {
      toast.success("Section validée");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Validation impossible"),
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
      const { error: e } = await supabase.rpc("admin_decide_driver", {
        _driver: driverId,
        _decision: decision,
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

  const docsBySection = useMemo(() => {
    const map = new Map<string, Dossier["documents"]>();
    for (const [key, types] of Object.entries(SECTION_DOCS)) {
      map.set(key, (data?.documents ?? []).filter((d) => types.includes(d.doc_type)));
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

  return (
    <div className="pb-16">
      <Link to="/admin/chauffeurs" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Retour aux dossiers
      </Link>

      <PageHeader
        title={data.profile?.full_name || data.driver?.business_name || "Dossier chauffeur"}
        description={`${data.profile?.email ?? "—"} · ${data.profile?.phone ?? "—"} · dossier complété à ${state?.percent ?? 0} %`}
      />

      <div className="surface mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <StatusBadge status={data.driver?.verification_status ?? "incomplete"} labels={VERIFICATION_LABELS} />
          <span className="text-xs text-muted-foreground">
            Envoyé le {formatDateTime(data.driver?.submitted_at)}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
          <Download className="size-4" /> Télécharger le dossier (ZIP)
        </Button>
      </div>

      <Accordion type="multiple" className="space-y-3">
        {sections.map((s) => {
          const docs = docsBySection.get(s.key) ?? [];
          const validated = data.sectionReviews.find((r) => r.section === s.key);
          return (
            <AccordionItem key={s.key} value={s.key} className="surface border-none px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex w-full items-center justify-between gap-3 pr-2">
                  <span className="text-sm font-medium">{s.label}</span>
                  <span
                    className={`text-xs ${
                      s.state === "approved"
                        ? "text-primary"
                        : s.state === "todo"
                          ? "text-muted-foreground"
                          : "text-destructive"
                    }`}
                  >
                    {SECTION_STATE_LABELS[s.state as SectionState] ?? s.state}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
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
                            <span className="font-medium">{DOCUMENT_LABELS[doc.doc_type] ?? doc.doc_type}</span>
                            <span className="text-muted-foreground"> · échéance {formatDate(doc.expires_at)}</span>
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
                          <Button
                            size="sm"
                            onClick={() => reviewDoc.mutate({ id: doc.id, decision: "approved" })}
                          >
                            <Check className="size-4" /> Valider
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
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
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune pièce jointe pour cette section.</p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={s.state !== "approved"}
                    title={s.state === "approved" ? undefined : "Toutes les pièces obligatoires doivent être validées"}
                    onClick={() => validateSection.mutate(s.key)}
                  >
                    <ShieldCheck className="size-4" /> Valider cette section
                  </Button>
                  {validated ? (
                    <span className="text-xs text-muted-foreground">
                      Validée le {formatDateTime(validated.updated_at)}
                    </span>
                  ) : null}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

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
            disabled={!state?.all_approved}
            title={state?.all_approved ? undefined : "Toutes les pièces doivent être validées"}
            onClick={() => decide.mutate("approve")}
          >
            Valider le compte
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide.mutate("changes")}>
            Demander une correction
          </Button>
          <Button size="sm" variant="ghost" onClick={() => decide.mutate("reject")}>
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
      </div>

      <DocumentViewer document={viewer} open={!!viewer} onOpenChange={(v) => !v && setViewer(null)} />

      <AlertDialog open={exportOpen} onOpenChange={setExportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="size-4" /> Télécharger l'intégralité du dossier
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
