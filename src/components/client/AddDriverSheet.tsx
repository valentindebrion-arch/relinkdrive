import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Keyboard, QrCode, X } from "lucide-react";
import { QrScannerDialog } from "@/components/QrScannerDialog";

/** Extrait le code ReLink (slug) d'une URL de QR code ou d'une saisie manuelle. */
export function parseDriverCode(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;
  try {
    const url = new URL(
      raw,
      typeof window === "undefined" ? "https://relink.app" : window.location.origin,
    );
    const match = url.pathname.match(/\/chauffeur\/([^/?#]+)/);
    if (match?.[1]) return match[1];
  } catch {
    /* saisie libre */
  }
  const fallback = raw.match(/([A-Za-z0-9-]+)$/);
  return fallback?.[1] ?? null;
}

/**
 * Parcours d'ajout d'un chauffeur : scan du QR code (voie principale)
 * ou saisie manuelle d'un code ReLink (voie secondaire).
 */
export function AddDriverSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [scanOpen, setScanOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState("");

  const go = useCallback(
    (text: string) => {
      const slug = parseDriverCode(text);
      if (!slug) {
        toast.error("Code non reconnu", {
          description: "Ce code ne correspond à aucun chauffeur ReLink.",
        });
        return;
      }
      setScanOpen(false);
      setManual(false);
      setCode("");
      onClose();
      void navigate({ to: "/chauffeur/$slug", params: { slug } });
    },
    [navigate, onClose],
  );

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-[2px]">
        <button
          type="button"
          aria-label="Fermer"
          className="absolute inset-0 cursor-default"
          onClick={onClose}
        />
        <div
          className="relative w-full max-w-md rounded-t-[2rem] border border-border/60 bg-card p-5 shadow-2xl"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
        >
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" aria-hidden />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-muted text-muted-foreground"
          >
            <X className="size-4" />
          </button>

          <h2 className="text-lg font-black tracking-tight">Ajouter un chauffeur</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Scannez le QR code présenté par votre chauffeur en fin de course.
          </p>

          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-extrabold text-primary-foreground transition active:scale-[0.985]"
          >
            <QrCode className="size-5" /> Scanner le QR code
          </button>

          {manual ? (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                go(code);
              }}
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code ReLink"
                autoFocus
                className="min-h-12 flex-1 rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:border-primary"
              />
              <button
                type="submit"
                className="min-h-12 rounded-2xl bg-foreground px-4 text-sm font-bold text-background"
              >
                Valider
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setManual(true)}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background text-sm font-bold text-foreground transition active:scale-[0.985]"
            >
              <Keyboard className="size-4" /> Saisir un code ReLink
            </button>
          )}
        </div>
      </div>

      <QrScannerDialog open={scanOpen} onClose={() => setScanOpen(false)} onResult={go} />
    </>
  );
}
