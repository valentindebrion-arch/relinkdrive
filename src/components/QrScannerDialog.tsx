import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onResult: (text: string) => void;
};

const REGION_ID = "relink-qr-region";

export function QrScannerDialog({ open, onClose, onResult }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    handledRef.current = false;
    setError(null);
    setStarting(true);

    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const instance = new Html5Qrcode(REGION_ID, { verbose: false });
        scanner = instance as unknown as { stop: () => Promise<void>; clear: () => void };
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (handledRef.current) return;
            handledRef.current = true;
            onResult(decoded);
          },
          () => {},
        );
        if (!cancelled) setStarting(false);
      } catch (e) {
        if (cancelled) return;
        setStarting(false);
        setError(
          e instanceof Error && /permission|denied|NotAllowed/i.test(e.message)
            ? "Accès à la caméra refusé. Autorisez la caméra dans votre navigateur."
            : "Impossible d'ouvrir la caméra sur cet appareil.",
        );
      }
    })();

    return () => {
      cancelled = true;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner?.clear())
          .catch(() => {});
      }
    };
  }, [open, onResult]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="flex items-center gap-2 font-semibold">
          <Camera className="h-5 w-5 text-primary" /> Scanner le QR code
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le scanner"
          className="grid h-10 w-10 place-items-center rounded-full border border-border transition hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-black">
          <div id={REGION_ID} className="w-full [&_video]:w-full [&_video]:rounded-3xl" />
          {starting ? (
            <div className="absolute inset-0 grid place-items-center text-primary-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="max-w-sm text-center text-sm text-destructive">{error}</p>
        ) : (
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            Placez le QR code de votre chauffeur dans le cadre pour ouvrir sa fiche.
          </p>
        )}
      </div>
    </div>
  );
}
