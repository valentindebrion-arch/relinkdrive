import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileWarning,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile, useMyDocuments } from "@/lib/driver-queries";
import {
  DOSSIER_STATUS_LABELS,
  SECTION_STATE_LABELS,
  useDossierState,
  type DossierSection,
  type SectionState,
} from "@/lib/driver-dossier";
import { DOCUMENT_LABELS, formatDate } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const MAX_SIZE = 8 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

/** Champs à compléter en dehors du dépôt de pièces, par section. */
const FIELD_TARGETS: Record<string, { label: string; to: string }> = {
  identity: { label: "Compléter mes informations personnelles", to: "/pro/parametres" },
  vtc: { label: "Renseigner mon numéro de carte VTC", to: "/pro/entreprise" },
  company: { label: "Compléter mes informations d'entreprise", to: "/pro/entreprise" },
  vehicle: { label: "Compléter les informations du véhicule", to: "/pro/vehicule" },
  tax: { label: "Configurer mon régime de TVA et mes tarifs", to: "/pro/entreprise" },
};

const STATE_STYLES: Record<SectionState, string> = {
  todo: "bg-muted text-muted-foreground",
  review: "bg-warning/15 text-warning-foreground",
  approved: "bg-primary/10 text-primary",
  changes: "bg-destructive/10 text-destructive",
  expired: "bg-destructive/10 text-destructive",
};

const LAST_SECTION_KEY = "relink:dossier:last-section";
const READ_ONLY = ["pending", "under_review"];

function isDone(s: SectionState) {
  return s === "review" || s === "approved";
}

export function DossierPage() {
  const { user } = useAuth();
  const driver = useDriverProfile();
  const docs = useMyDocuments();
  const dossier = useDossierState();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/pro/dossier" }) as { section?: string };
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const status = driver.data?.verification_status ?? "incomplete";
  const state = dossier.data;
  const sections = useMemo(() => state?.sections ?? [], [state]);
  const readOnly = READ_ONLY.includes(status);

  const openKey = search.section;

  useEffect(() => {
    if (openKey && typeof window !== "undefined") {
      window.localStorage.setItem(LAST_SECTION_KEY, openKey);
      window.scrollTo({ top: 0 });
    }
  }, [openKey]);

  function goSection(key: string | undefined) {
    void navigate({ to: "/pro/dossier/completer", search: key ? { section: key } : {} });
  }

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["my-documents"] });
    void qc.invalidateQueries({ queryKey: ["dossier-state"] });
    void qc.invalidateQueries({ queryKey: ["driver-profile"] });
  }

  async function uploadDoc(docType: string, file: File, expiresAt: string) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Format non accepté (JPEG, PNG, WEBP ou PDF).");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Fichier trop volumineux (8 Mo maximum).");
      return;
    }
    setBusy(docType);
    const path = `${user!.id}/${docType}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
    if (upErr) {
      setBusy(null);
      toast.error(upErr.message);
      return;
    }
    const existing = (docs.data ?? []).find((d) => d.doc_type === docType);
    const payload = {
      driver_id: user!.id,
      doc_type: docType,
      file_path: path,
      expires_at: expiresAt || null,
    };
    const { error } = existing
      ? await supabase.from("verification_documents").update(payload).eq("id", existing.id)
      : await supabase.from("verification_documents").insert(payload);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Document enregistré. Son statut passe à « À vérifier ».");
    refresh();
  }

  async function submitDossier() {
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_driver_dossier");
    setSubmitting(false);
    setConfirmOpen(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Votre dossier a bien été transmis. Il est en cours de vérification.");
    refresh();
  }

  const canSubmit =
    !!state?.complete && ["incomplete", "changes_requested", "expired_documents"].includes(status);

  /** Section de reprise : corrections d'abord, puis dernière section commencée, puis première incomplète. */
  const resumeKey = useMemo(() => {
    if (!sections.length) return undefined;
    const fix = sections.find((s) => s.state === "changes" || s.state === "expired");
    if (fix) return fix.key;
    const last = typeof window !== "undefined" ? window.localStorage.getItem(LAST_SECTION_KEY) : null;
    if (last && sections.some((s) => s.key === last && !isDone(s.state))) return last;
    const todo = sections.find((s) => !isDone(s.state));
    return (todo ?? sections[0])!.key;
  }, [sections]);

  const changesCount = sections.filter((s) => s.state === "changes").length;
  const started = (state?.percent ?? 0) > 0;

  const primary: { label: string; action: () => void } | null = (() => {
    if (readOnly) return null;
    if (status === "verified")
      return { label: "Accéder à mon espace professionnel", action: () => void navigate({ to: "/pro" }) };
    if (status === "suspended" || status === "rejected") return null;
    if (status === "expired_documents")
      return { label: "Mettre à jour mes documents", action: () => goSection(resumeKey) };
    if (status === "changes_requested")
      return { label: "Corriger mon dossier", action: () => goSection(resumeKey) };
    if (state?.complete)
      return { label: "Vérifier et envoyer mon dossier", action: () => goSection("review") };
    return { label: started ? "Reprendre mon dossier" : "Compléter mon dossier", action: () => goSection(resumeKey) };
  })();

  function nextSectionKey(from: string) {
    const idx = sections.findIndex((s) => s.key === from);
    const rest = sections.slice(idx + 1);
    return (rest.find((s) => !isDone(s.state)) ?? rest[0])?.key;
  }

  /* ---------- Statut du compte ---------- */
  return (
    <div className="space-y-5">
      <header className="surface p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-primary/10 p-2 text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">
              {status === "verified" ? "Votre compte professionnel est actif" : "Activez votre compte professionnel"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {status === "verified"
                ? "Votre compte professionnel a été validé. Vous pouvez maintenant utiliser toutes les fonctionnalités ReLink."
                : "Complétez votre dossier puis transmettez-le pour vérification. Après validation, vous pourrez recevoir des demandes et partager votre profil."}
            </p>
            <p className="mt-3 inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium">
              {DOSSIER_STATUS_LABELS[status] ?? status}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progression du dossier</span>
            <span className="font-semibold text-foreground">{state?.percent ?? 0} %</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${state?.percent ?? 0}%` }} />
          </div>
        </div>

        {primary ? (
          <Button
            size="lg"
            className="mt-4 h-12 w-full text-base"
            disabled={submitting || dossier.isLoading}
            aria-label={primary.label}
            onClick={primary.action}
          >
            {primary.label}
          </Button>
        ) : null}

        {readOnly ? (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <Clock className="mt-0.5 size-4 shrink-0" />
            Votre dossier est en cours de vérification.
          </p>
        ) : null}

        {changesCount > 0 ? (
          <p className="mt-3 text-sm text-destructive">
            {changesCount} section{changesCount > 1 ? "s" : ""} à corriger.
          </p>
        ) : null}

        {status === "changes_requested" && driver.data?.rejection_reason ? (
          <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            Des corrections sont nécessaires avant la validation de votre compte : {driver.data.rejection_reason}
          </p>
        ) : null}
        {status === "rejected" && driver.data?.rejection_reason ? (
          <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            Motif du refus : {driver.data.rejection_reason}
          </p>
        ) : null}
        {status === "suspended" ? (
          <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            Votre compte est suspendu. Vos courses, factures et historiques restent accessibles.
          </p>
        ) : null}
        {status === "expired_documents" ? (
          <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            Un justificatif obligatoire a expiré. Remplacez-le puis renvoyez votre dossier.
          </p>
        ) : null}
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Sections du dossier</h2>
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => goSection(section.key)}
            className={`surface tap-active flex w-full items-center justify-between gap-3 p-4 text-left ${
              section.state === "changes" || section.state === "expired" ? "border-destructive/40 bg-destructive/5" : ""
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{section.label}</span>
              {section.missing.length ? (
                <span className="block text-xs text-muted-foreground">
                  {section.missing.includes("fields") ? "Informations à compléter" : "Pièces à fournir"}
                </span>
              ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATE_STYLES[section.state]}`}>
                {SECTION_STATE_LABELS[section.state]}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </span>
          </button>
        ))}
      </section>

      {status !== "verified" && !readOnly ? (
        <div className="surface space-y-3 p-4">
          {!state?.complete ? (
            <p className="text-sm text-muted-foreground">
              Il manque encore des informations ou des pièces obligatoires pour envoyer votre dossier.
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-primary" /> Votre dossier est complet.
            </p>
          )}
          <Button className="w-full" disabled={!canSubmit || submitting} onClick={() => goSection("review")}>
            <Upload className="size-4" /> Envoyer mon dossier pour vérification
          </Button>
        </div>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmez-vous que les informations et documents transmis sont exacts et à jour ?</AlertDialogTitle>
            <AlertDialogDescription>
              Récapitulatif : {sections.length} section{sections.length > 1 ? "s" : ""} complétées, progression{" "}
              {state?.percent ?? 0} %. Votre dossier sera transmis à l'équipe ReLink pour vérification. Vous serez
              informé dès qu'une décision sera prise.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void submitDossier()}>Confirmer l'envoi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
