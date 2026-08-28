import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile, useMyDocuments } from "@/lib/driver-queries";
import { PageHeader } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import {
  DOCUMENT_LABELS,
  DOCUMENT_TYPES,
  DOC_STATUS_LABELS,
  VERIFICATION_LABELS,
  formatDate,
} from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export function VerificationPage() {
  const { user } = useAuth();
  const driver = useDriverProfile();
  const docs = useMyDocuments();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  async function uploadDoc(docType: string, file: File, expiresAt: string) {
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
    toast.success("Document envoyé");
    void qc.invalidateQueries({ queryKey: ["my-documents"] });
  }

  async function submitForReview() {
    const { error } = await supabase
      .from("driver_profiles")
      .update({ verification_status: "pending" })
      .eq("user_id", user!.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Dossier envoyé pour vérification");
    void qc.invalidateQueries({ queryKey: ["driver-profile"] });
  }

  const status = driver.data?.verification_status ?? "incomplete";

  return (
    <>
      <PageHeader title="Vérification" description="Envoyez vos justificatifs pour activer votre compte." />

      <div className="surface mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-muted-foreground">Statut du dossier</p>
          <StatusBadge status={status} labels={VERIFICATION_LABELS} />
          {driver.data?.rejection_reason ? (
            <p className="mt-2 text-sm text-destructive">Motif : {driver.data.rejection_reason}</p>
          ) : null}
        </div>
        {status !== "verified" ? <Button onClick={submitForReview}>Envoyer pour vérification</Button> : null}
      </div>

      <div className="space-y-3">
        {DOCUMENT_TYPES.map((type) => {
          const doc = (docs.data ?? []).find((d) => d.doc_type === type);
          return (
            <div key={type} className="surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{DOCUMENT_LABELS[type]}</p>
                  {doc ? (
                    <p className="text-sm text-muted-foreground">
                      Envoyé{doc.expires_at ? ` · expire le ${formatDate(doc.expires_at)}` : ""}
                      {doc.review_note ? ` · ${doc.review_note}` : ""}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun document</p>
                  )}
                </div>
                {doc ? <StatusBadge status={doc.status} labels={DOC_STATUS_LABELS} /> : null}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`exp-${type}`}>Date d'expiration (optionnel)</Label>
                  <Input id={`exp-${type}`} type="date" defaultValue={doc?.expires_at ?? ""} />
                </div>
                <div>
                  <Label htmlFor={`file-${type}`}>Fichier</Label>
                  <Input
                    id={`file-${type}`}
                    type="file"
                    accept="image/*,application/pdf"
                    disabled={busy === type}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      const exp = (document.getElementById(`exp-${type}`) as HTMLInputElement | null)?.value ?? "";
                      if (file) void uploadDoc(type, file, exp);
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
