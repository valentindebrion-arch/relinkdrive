import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, ChevronRight, Clock, FileWarning, ShieldCheck, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile, useMyDocuments } from "@/lib/driver-queries";
import {
  DOSSIER_STATUS_LABELS,
  SECTION_STATE_LABELS,
  useDossierState,
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

export function DossierPage() {
  const { user } = useAuth();
  const driver = useDriverProfile();
  const docs = useMyDocuments();
  const dossier = useDossierState();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const status = driver.data?.verification_status ?? "incomplete";
  const state = dossier.data;

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
    toast.success("Document transmis, il sera vérifié par ReLink.");
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
        {status === "pending" || status === "under_review" ? (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <Clock className="mt-0.5 size-4 shrink-0" />
            Votre dossier a bien été transmis. Il est en cours de vérification par l'équipe ReLink.
          </p>
        ) : null}
      </header>

      <section className="space-y-3">
        {(state?.sections ?? []).map((section) => {
          const target = FIELD_TARGETS[section.key];
          const fieldsMissing = section.missing.includes("fields");
          return (
            <div key={section.key} className="surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{section.label}</p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATE_STYLES[section.state]}`}>
                  {SECTION_STATE_LABELS[section.state]}
                </span>
              </div>

              {fieldsMissing && target ? (
                <Link
                  to={target.to}
                  className="mt-3 flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <AlertCircle className="size-4 text-muted-foreground" />
                    {target.label}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              ) : null}

              <div className="mt-3 space-y-3">
                {section.docs.map((type) => {
                  const doc = (docs.data ?? []).find((d) => d.doc_type === type);
                  const expired = doc?.expires_at ? new Date(doc.expires_at) < new Date() : false;
                  return (
                    <div key={type} className="rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{DOCUMENT_LABELS[type] ?? type}</p>
                        <span className="text-xs text-muted-foreground">
                          {!doc?.file_path
                            ? "Aucun document"
                            : expired
                              ? "Expiré"
                              : doc.status === "approved"
                                ? "Validé"
                                : doc.status === "rejected"
                                  ? "Correction demandée"
                                  : "À vérifier"}
                        </span>
                      </div>
                      {doc?.file_path ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Transmis{doc.expires_at ? ` · valable jusqu'au ${formatDate(doc.expires_at)}` : ""}
                        </p>
                      ) : null}
                      {doc?.review_note && doc.status === "rejected" ? (
                        <p className="mt-1 flex items-start gap-1.5 text-xs text-destructive">
                          <FileWarning className="mt-0.5 size-3.5 shrink-0" />
                          {doc.review_note}
                        </p>
                      ) : null}
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`exp-${type}`} className="text-xs">
                            Date de validité
                          </Label>
                          <Input id={`exp-${type}`} type="date" defaultValue={doc?.expires_at ?? ""} />
                        </div>
                        <div>
                          <Label htmlFor={`file-${type}`} className="text-xs">
                            {doc?.file_path ? "Remplacer le document" : "Déposer le document"}
                          </Label>
                          <Input
                            id={`file-${type}`}
                            type="file"
                            accept="image/*,application/pdf"
                            disabled={busy === type}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              const exp =
                                (document.getElementById(`exp-${type}`) as HTMLInputElement | null)?.value ?? "";
                              if (file) void uploadDoc(type, file, exp);
                            }}
                          />
                        </div>
                      </div>
                      {doc?.status === "approved" ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Un document remplacé repasse automatiquement en vérification.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {status !== "verified" ? (
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
          <Button className="w-full" disabled={!canSubmit || submitting} onClick={() => setConfirmOpen(true)}>
            <Upload className="size-4" /> Envoyer mon dossier pour vérification
          </Button>
        </div>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmez-vous que les informations et documents transmis sont exacts et à jour ?</AlertDialogTitle>
            <AlertDialogDescription>
              Votre dossier sera transmis à l'équipe ReLink pour vérification. Vous serez informé dès qu'une décision
              sera prise.
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
