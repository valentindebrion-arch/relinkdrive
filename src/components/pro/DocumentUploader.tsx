import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSignedUrl } from "@/lib/storage";
import { formatDate } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_SIZE = 8 * 1024 * 1024;
const ACCEPTED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

export type DriverDocument = {
  id: string;
  doc_type: string;
  file_path: string | null;
  status: string;
  expires_at: string | null;
  review_note: string | null;
};

const STATUS_TEXT: Record<string, string> = {
  pending: "À vérifier",
  approved: "Validé",
  rejected: "Correction demandée",
  expired: "Expiré",
};

/** Compresse les photos volumineuses sans dégrader la lisibilité du justificatif. */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/heic" || file.type === "image/heif") return file;
  if (file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.86));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function DocumentUploader({
  docType,
  label,
  doc,
  required,
  withExpiry = true,
  help,
  readOnly,
}: {
  docType: string;
  label: string;
  doc?: DriverDocument | null;
  required?: boolean;
  withExpiry?: boolean;
  help?: string;
  readOnly?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expires, setExpires] = useState(doc?.expires_at ?? "");
  const preview = useSignedUrl("documents", doc?.file_path ?? null);
  const isPdf = (doc?.file_path ?? "").toLowerCase().endsWith(".pdf");
  const expired = doc?.expires_at ? new Date(doc.expires_at) < new Date() : false;

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["my-documents"] });
    void qc.invalidateQueries({ queryKey: ["dossier-state"] });
  }

  async function onFile(file: File) {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      const msg = "Format refusé. Utilisez un PDF, un JPEG, un PNG ou une photo de votre téléphone.";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (file.size > MAX_SIZE) {
      const msg = "Fichier trop volumineux (8 Mo maximum).";
      setError(msg);
      toast.error(msg);
      return;
    }
    setBusy(true);
    try {
      const prepared = await compressImage(file);
      const safeName = prepared.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user!.id}/${docType}-${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, prepared, { upsert: true });
      if (upErr) throw upErr;
      const payload = {
        driver_id: user!.id,
        doc_type: docType,
        file_path: path,
        expires_at: expires || null,
        status: "pending" as const,
        review_note: null,
      };
      const { error: dbErr } = doc?.id
        ? await supabase.from("verification_documents").update(payload).eq("id", doc.id)
        : await supabase.from("verification_documents").insert(payload);
      if (dbErr) throw dbErr;
      toast.success(`${label} enregistré. Statut : à vérifier.`);
      refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de l'envoi. Vérifiez votre connexion puis réessayez.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function saveExpiry(value: string) {
    setExpires(value);
    if (!doc?.id) return;
    const { error: err } = await supabase
      .from("verification_documents")
      .update({ expires_at: value || null })
      .eq("id", doc.id);
    if (err) {
      toast.error(err.message);
      return;
    }
    refresh();
  }

  async function removeDoc() {
    if (!doc?.id) return;
    setBusy(true);
    if (doc.file_path) await supabase.storage.from("documents").remove([doc.file_path]);
    const { error: err } = await supabase.from("verification_documents").delete().eq("id", doc.id);
    setBusy(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Document supprimé.");
    refresh();
  }

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {label} {required ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(facultatif)</span>}
        </p>
        <span className={`text-xs ${expired ? "text-destructive" : "text-muted-foreground"}`}>
          {!doc?.file_path ? "Aucun document" : expired ? "Expiré" : (STATUS_TEXT[doc.status] ?? doc.status)}
        </span>
      </div>
      {help ? <p className="mt-1 text-xs text-muted-foreground">{help}</p> : null}

      {doc?.review_note && doc.status === "rejected" ? (
        <p className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{doc.review_note}</p>
      ) : null}

      {doc?.file_path ? (
        <div className="mt-2 flex items-center gap-3">
          <div className="flex size-14 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
            {isPdf || !preview.data ? (
              <FileText className="size-5 text-muted-foreground" />
            ) : (
              <img src={preview.data} alt={`Aperçu ${label}`} className="size-full object-cover" loading="lazy" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-primary" /> Transmis
              {doc.expires_at ? ` · valable jusqu'au ${formatDate(doc.expires_at)}` : ""}
            </p>
            {preview.data ? (
              <a href={preview.data} target="_blank" rel="noreferrer" className="underline">
                Ouvrir le document
              </a>
            ) : null}
          </div>
          {readOnly ? null : (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void removeDoc()}>
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ) : null}

      {readOnly ? null : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {withExpiry ? (
            <div>
              <Label htmlFor={`exp-${docType}`} className="text-xs">
                Date d'expiration
              </Label>
              <Input
                id={`exp-${docType}`}
                type="date"
                value={expires}
                onChange={(e) => void saveExpiry(e.target.value)}
              />
            </div>
          ) : null}
          <div>
            <Label htmlFor={`file-${docType}`} className="text-xs">
              {doc?.file_path ? "Remplacer le document" : "Déposer le document"}
            </Label>
            <Input
              id={`file-${docType}`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void onFile(f);
              }}
            />
          </div>
        </div>
      )}

      {busy ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Envoi en cours…
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      {!doc?.file_path && !busy && !readOnly ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Upload className="size-3.5" /> PDF, JPEG ou PNG · 8 Mo maximum
        </p>
      ) : null}
    </div>
  );
}
