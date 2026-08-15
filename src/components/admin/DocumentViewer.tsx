import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, FileText, Loader2, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { getDocumentUrl } from "@/lib/admin-dossier.functions";
import { DOCUMENT_LABELS, formatDate } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type ReviewDocument = {
  id: string;
  doc_type: string;
  file_path: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
  review_note: string | null;
  driverName?: string | null;
};


function isPdf(path?: string | null) {
  return !!path && path.toLowerCase().endsWith(".pdf");
}

/** Visionneuse sécurisée : aucune URL permanente, uniquement des liens signés courts. */
export function DocumentViewer({
  document: doc,
  open,
  onOpenChange,
}: {
  document: ReviewDocument | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const fetchUrl = useServerFn(getDocumentUrl);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!open || !doc?.file_path) return;
    setUrl(null);
    setZoom(1);
    setRotation(0);
    setLoading(true);
    fetchUrl({ data: { documentId: doc.id } })
      .then((r) => setUrl(r.url))
      .catch(() => toast.error("Impossible d'ouvrir cette pièce"))
      .finally(() => setLoading(false));
  }, [open, doc?.id, doc?.file_path, fetchUrl]);

  const download = async () => {
    if (!doc) return;
    try {
      const r = await fetchUrl({ data: { documentId: doc.id, download: true } });
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Téléchargement indisponible");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            {doc ? (DOCUMENT_LABELS[doc.doc_type] ?? doc.doc_type) : "Pièce"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Déposé le {formatDate(doc?.created_at)}</span>
          <span>· Échéance {formatDate(doc?.expires_at)}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
            <ZoomIn className="size-4" /> Agrandir
          </Button>
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
            <ZoomOut className="size-4" /> Réduire
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRotation((r) => (r + 90) % 360)}>
            <RotateCw className="size-4" /> Pivoter
          </Button>
          <Button size="sm" variant="outline" onClick={download}>
            <Download className="size-4" /> Télécharger
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-auto rounded-xl border border-border bg-muted/30 p-3">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : !url ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucun fichier disponible.</p>
          ) : isPdf(doc?.file_path) ? (
            <iframe title="Document" src={url} className="h-[55vh] w-full rounded-lg bg-background" />
          ) : (
            <div className="flex justify-center">
              <img
                src={url}
                alt={doc ? (DOCUMENT_LABELS[doc.doc_type] ?? doc.doc_type) : "Document"}
                style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                className="max-w-full origin-center transition-transform"
              />
            </div>
          )}
        </div>

        {doc?.review_note ? (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <FileText className="mt-0.5 size-3.5" /> Dernière remarque : {doc.review_note}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
