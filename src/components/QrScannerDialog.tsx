import { useEffect, useRef, useState } from "react";
import { X, Camera } from "lucide-react";

type Detected = { rawValue: string };
type DetectorLike = { detect: (source: CanvasImageSource) => Promise<Detected[]> };

/**
 * Lecteur de QR code ReLink.
 *
 * Utilise l'API navigateur BarcodeDetector lorsqu'elle est disponible ;
 * sinon l'utilisateur saisit le code manuellement depuis la feuille appelante.
 */
export function QrScannerDialog({
  open,
  onClose,
  onResult,
}: {
  open: boolean;
  onClose: () => void;
  onResult: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    const Ctor = (
      window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => DetectorLike }
    ).BarcodeDetector;

    void (async () => {
      if (!Ctor) {
        setError(
          "La lecture automatique n'est pas disponible sur cet appareil. Saisissez le code du chauffeur.",
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const detector = new Ctor({ formats: ["qr_code"] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue;
            if (value) {
              onResult(value);
              onClose();
              return;
            }
          } catch {
            /* image non exploitable, on réessaie */
          }
          raf = requestAnimationFrame(() => void tick());
        };
        raf = requestAnimationFrame(() => void tick());
      } catch {
        if (!cancelled)
          setError("Accès à la caméra refusé. Saisissez le code du chauffeur à la place.");
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onClose, onResult]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-foreground/90">
      <div className="flex items-center justify-between px-4 py-3 text-background">
        <p className="text-sm font-semibold">Scanner un QR code ReLink</p>
        <button type="button" onClick={onClose} aria-label="Fermer le scanner">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video ref={videoRef} playsInline muted className="size-full object-cover" />
        {error ? (
          <div className="absolute inset-x-6 rounded-2xl bg-card p-4 text-center text-sm">
            <Camera className="mx-auto mb-2 size-5 text-muted-foreground" />
            {error}
          </div>
        ) : (
          <span className="pointer-events-none absolute size-56 rounded-3xl border-2 border-background/80" />
        )}
      </div>
    </div>
  );
}
