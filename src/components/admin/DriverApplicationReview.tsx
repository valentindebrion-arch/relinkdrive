import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, Eye, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getDocumentUrl, getDriverDossier } from "@/lib/admin-dossier.functions";
import {
  APPLICATION_DOCS,
  APPLICATION_STATUS_LABELS,
  DRIVER_KIND_LABELS,
  REJECT_REASONS,
} from "@/lib/driver-application";
import { formatDateTime } from "@/lib/labels";
import { DocumentViewer, type ReviewDocument } from "@/components/admin/DocumentViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type RejectTarget = { kind: "document"; id: string; label: string } | { kind: "pro" };

export function DriverApplicationReview({ driverId }: { driverId: string }) {
  const load = useServerFn(getDriverDossier);
  const fetchUrl = useServerFn(getDocumentUrl);
  const qc = useQueryClient();
  const [viewed, setViewed] = useState<ReviewDocument | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [reason, setReason] = useState(REJECT_REASONS[0]!);
  const [customReason, setCustomReason] = useState("");
  const [authorizeOpen, setAuthorizeOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["driver-application", driverId],
    queryFn: () => load({ data: { driverId } }),
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["driver-application", driverId] });
    void qc.invalidateQueries({ queryKey: ["driver-applications"] });
  }

  const dossier = q.data;
  const driver = dossier?.driver as
    | { verification_status?: string; driver_kind?: string | null; vtc_card_number?: string | null; taxi_license_number?: string | null; approved_at?: string | null }
    | null
    | undefined;
  const name = (dossier?.profile as { full_name?: string } | null)?.full_name ?? "ce chauffeur";
  const state = dossier?.state as
    | {
        all_approved?: boolean;
        sections?: { key: string; state: string; label?: string; missing?: string[] }[];
      }
    | null
    | undefined;
  const proSection = state?.sections?.find((s) => s.key === "pro");
  const blocking = (state?.sections ?? [])
    .filter((s) => s.state !== "approved")
    .map((s) => {
      const label = s.label ?? s.key;
      if (s.state === "todo") return `${label} : élément manquant`;
      if (s.state === "expired") return `${label} : document expiré`;
      if (s.state === "changes") return `${label} : pièce refusée / correction demandée`;
      return `${label} : en attente de validation`;
    });
  const kind = driver?.driver_kind === "taxi" ? "taxi" : "vtc";
  const number = (kind === "taxi" ? driver?.taxi_license_number : driver?.vtc_card_number) ?? "—";
  const verified = driver?.verification_status === "verified";

  const documents = (dossier?.documents ?? []) as ReviewDocument[];
  function docOf(type: string) {
    return documents.find((d) => d.doc_type === type) ?? null;
  }

  async function approveDoc(id: string) {
    setBusy(id);
    const { error } = await supabase.rpc("admin_review_document", {
      _document: id,
      _decision: "approved",
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Document validé.");
    refresh();
  }

  async function approvePro() {
    setBusy("pro");
    const { error } = await supabase.rpc("admin_validate_section", {
      _driver: driverId,
      _section: "pro",
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Informations professionnelles validées.");
    refresh();
  }

  async function confirmReject() {
    const note = reason === "Autre" ? customReason.trim() : reason;
    if (!note) {
      toast.error("Indiquez un motif.");
      return;
    }
    const target = rejectTarget;
    if (!target) return;
    setBusy("reject");
    const { error } =
      target.kind === "document"
        ? await supabase.rpc("admin_review_document", {
            _document: target.id,
            _decision: "rejected",
            _note: note,
          })
        : await supabase.rpc("admin_review_section", {
            _driver: driverId,
            _section: "pro",
            _decision: "changes",
            _note: note,
          });
    setBusy(null);
    setRejectTarget(null);
    setCustomReason("");
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Élément marqué à corriger. Le chauffeur en est informé.");
    refresh();
  }

  async function authorize() {
    setAuthorizeOpen(false);
    setBusy("authorize");
    const { error } = await supabase.rpc("admin_decide_driver", {
      _driver: driverId,
      _decision: "approve",
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${name} est désormais autorisé sur ReLink.`);
    refresh();
  }

  async function download(id: string) {
    try {
      const r = await fetchUrl({ data: { documentId: id, download: true } });
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Téléchargement indisponible");
    }
  }

  if (q.isLoading) {
    return (
      <div className="surface flex items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (q.isError) {
    return <p className="surface p-5 text-sm text-destructive">Dossier indisponible.</p>;
  }

  return (
    <div className="space-y-4">
      <header className="surface p-5">
        <p className="text-xs text-muted-foreground">Demande d'inscription chauffeur</p>
        <h1 className="text-lg font-semibold">{name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {DRIVER_KIND_LABELS[kind]} · {number} ·{" "}
          {APPLICATION_STATUS_LABELS[driver?.verification_status ?? ""] ??
            driver?.verification_status}
        </p>

        {verified ? (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm font-medium text-primary">
            <CheckCircle2 className="size-4" /> Chauffeur autorisé
            {driver?.approved_at ? ` le ${formatDateTime(driver.approved_at)}` : ""}
          </p>
        ) : state?.all_approved ? (
          <Button
            size="lg"
            className="mt-4 h-12 w-full text-base"
            disabled={busy === "authorize"}
            onClick={() => setAuthorizeOpen(true)}
          >
            <ShieldCheck className="size-5" /> Autoriser {name}
          </Button>
        ) : (
          <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            Validez chaque élément obligatoire pour pouvoir autoriser ce chauffeur.
          </p>
        )}
      </header>

      <section className="space-y-3">
        {APPLICATION_DOCS.map((item) => {
          const doc = docOf(item.docType);
          const approved = doc?.status === "approved";
          const rejected = doc?.status === "rejected";
          return (
            <div key={item.docType} className="surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{item.label}</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    approved
                      ? "bg-primary/10 text-primary"
                      : rejected
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {!doc?.file_path
                    ? "Non transmis"
                    : approved
                      ? "✓ Validé"
                      : rejected
                        ? "À corriger"
                        : "En attente"}
                </span>
              </div>

              {approved && (doc as { reviewed_at?: string | null })?.reviewed_at ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Validé le {formatDateTime((doc as { reviewed_at?: string | null }).reviewed_at)}
                </p>
              ) : null}
              {rejected && doc?.review_note ? (
                <p className="mt-1 text-xs text-destructive">Motif : {doc.review_note}</p>
              ) : null}

              {doc?.file_path ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setViewed(doc)}>
                    <Eye className="size-4" /> Consulter
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void download(doc.id)}>
                    <Download className="size-4" /> Télécharger
                  </Button>
                  {verified ? null : (
                    <>
                      <Button
                        size="sm"
                        disabled={approved || busy === doc.id}
                        onClick={() => void approveDoc(doc.id)}
                      >
                        <CheckCircle2 className="size-4" /> Valider le document
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setRejectTarget({ kind: "document", id: doc.id, label: item.label })
                        }
                      >
                        <XCircle className="size-4" /> Refuser
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Le chauffeur n'a pas encore transmis cette pièce.
                </p>
              )}
            </div>
          );
        })}

        <div className="surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {kind === "taxi" ? "Licence Taxi" : "Numéro VTC"}
            </p>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                proSection?.state === "approved"
                  ? "bg-primary/10 text-primary"
                  : proSection?.state === "changes"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {proSection?.state === "approved"
                ? "✓ Validé"
                : proSection?.state === "changes"
                  ? "À corriger"
                  : proSection?.state === "todo"
                    ? "Non renseigné"
                    : "En attente"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Statut déclaré : {DRIVER_KIND_LABELS[kind]} · Numéro : {number}
          </p>
          {verified ? null : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={proSection?.state === "approved" || busy === "pro"}
                onClick={() => void approvePro()}
              >
                <CheckCircle2 className="size-4" /> Valider
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejectTarget({ kind: "pro" })}>
                <XCircle className="size-4" /> Refuser
              </Button>
            </div>
          )}
        </div>
      </section>

      <DocumentViewer document={viewed} open={!!viewed} onOpenChange={(v) => !v && setViewed(null)} />

      <Dialog open={!!rejectTarget} onOpenChange={(v) => !v && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Motif du refus</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {REJECT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  reason === r ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                {r}
              </button>
            ))}
            {reason === "Autre" ? (
              <Input
                value={customReason}
                placeholder="Précisez le motif communiqué au chauffeur"
                onChange={(e) => setCustomReason(e.target.value)}
              />
            ) : null}
          </div>
          <Button disabled={busy === "reject"} onClick={() => void confirmReject()}>
            Marquer à corriger
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={authorizeOpen} onOpenChange={setAuthorizeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'autorisation de ce chauffeur sur ReLink ?</AlertDialogTitle>
            <AlertDialogDescription>
              {name} pourra recevoir des demandes et sa fiche publique deviendra visible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void authorize()}>Autoriser</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
