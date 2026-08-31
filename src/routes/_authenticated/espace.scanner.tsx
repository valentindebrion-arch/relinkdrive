/**
 * Scanner de QR code chauffeur ReLink.
 *
 * Ouvre la caméra (arrière en priorité), détecte automatiquement un QR code
 * et ouvre la vitrine du chauffeur via le lien traçable `/q/<slug>` : le scan
 * est donc comptabilisé comme `qr_scan`, une seule fois grâce au verrou de
 * détection. Aucune adresse externe n'est ouverte automatiquement, et les
 * règles d'accès Woman for Woman restent appliquées par la vitrine.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Link2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QR_DENIED_MESSAGE, QR_INVALID_MESSAGE, parseDriverQr } from "@/lib/qr-scan";

export const Route = createFileRoute("/_authenticated/espace/scanner")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Scanner un QR code chauffeur — ReLink" },
      {
        name: "description",
        content:
          "Scannez le QR code d'un chauffeur ReLink avec votre caméra pour ouvrir directement sa vitrine.",
      },
      { property: "og:title", content: "Scanner un QR code chauffeur — ReLink" },
      {
        property: "og:description",
        content: "Ouvrez la vitrine d'un chauffeur ReLink en scannant son QR code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScannerPage,
});

const READER_ID = "relink-qr-reader";

type Phase = "starting" | "scanning" | "denied" | "unsupported";

function ScannerPage() {
  const navigate = useNavigate();
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const handledRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("starting");
  const [notice, setNotice] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [attempt, setAttempt] = useState(0);

  const openDriver = useCallback(
    async (slug: string) => {
      if (handledRef.current) return;
      handledRef.current = true;
      try {
        await scannerRef.current?.stop();
      } catch {
        /* le scanner était déjà arrêté */
      }
      void navigate({ to: "/q/$slug", params: { slug } });
    },
    [navigate],
  );

  useEffect(() => {
    let cancelled = false;
    handledRef.current = false;
    setNotice(null);
    setPhase("starting");

    async function start() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(READER_ID, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            const slug = parseDriverQr(decoded);
            if (slug) {
              setNotice(null);
              void openDriver(slug);
            } else if (!handledRef.current) {
              setNotice(QR_INVALID_MESSAGE);
            }
          },
          () => {
            /* aucune détection sur cette image : comportement normal */
          },
        );
        if (cancelled) {
          await scanner.stop().catch(() => undefined);
          return;
        }
        setPhase("scanning");
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setPhase(/permission|denied|NotAllowed/i.test(message) ? "denied" : "unsupported");
      }
    }

    void start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .catch(() => undefined)
          .finally(() => {
            try {
              scanner.clear();
            } catch {
              /* déjà nettoyé */
            }
          });
      }
    };
  }, [attempt, openDriver]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const slug = parseDriverQr(manual);
    if (!slug) {
      setNotice(QR_INVALID_MESSAGE);
      return;
    }
    void openDriver(slug);
  }

  return (
    <div className="relative min-h-dvh bg-black text-white">
      {/* Caméra */}
      <div id={READER_ID} className="absolute inset-0 [&_video]:size-full [&_video]:object-cover" />

      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="flex items-center gap-2 p-4">
          <button
            type="button"
            onClick={() => void navigate({ to: "/espace" })}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-black/50 px-3 text-sm font-semibold backdrop-blur"
          >
            <ArrowLeft className="size-4" /> Retour
          </button>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          {phase === "scanning" || phase === "starting" ? (
            <>
              <div className="relative size-64 max-w-[72vw]">
                <span className="absolute left-0 top-0 size-10 rounded-tl-2xl border-l-4 border-t-4 border-primary" />
                <span className="absolute right-0 top-0 size-10 rounded-tr-2xl border-r-4 border-t-4 border-primary" />
                <span className="absolute bottom-0 left-0 size-10 rounded-bl-2xl border-b-4 border-l-4 border-primary" />
                <span className="absolute bottom-0 right-0 size-10 rounded-br-2xl border-b-4 border-r-4 border-primary" />
              </div>
              <p className="mt-6 rounded-xl bg-black/55 px-4 py-2 text-sm font-medium backdrop-blur">
                {phase === "starting"
                  ? "Ouverture de la caméra…"
                  : "Placez le QR code du chauffeur dans le cadre"}
              </p>
            </>
          ) : (
            <div className="w-full max-w-sm rounded-2xl bg-black/70 p-5 backdrop-blur">
              <Camera className="mx-auto size-8 text-primary" />
              <p className="mt-3 text-sm font-semibold">
                {phase === "denied"
                  ? QR_DENIED_MESSAGE
                  : "La caméra n'est pas disponible sur cet appareil ou ce navigateur."}
              </p>
              <Button
                className="mt-4 min-h-11 w-full"
                onClick={() => setAttempt((n) => n + 1)}
              >
                Réessayer
              </Button>
            </div>
          )}

          {notice ? (
            <p
              role="status"
              className="mt-4 rounded-xl bg-destructive/90 px-4 py-2 text-sm font-semibold"
            >
              {notice}
            </p>
          ) : null}
        </div>

        <form
          onSubmit={submitManual}
          className="relative z-10 space-y-2 rounded-t-3xl bg-black/70 p-5 backdrop-blur"
        >
          <label
            htmlFor="manual-link"
            className="flex items-center gap-2 text-sm font-semibold text-white/90"
          >
            <Link2 className="size-4" /> Saisir un lien ReLink
          </label>
          <div className="flex gap-2">
            <Input
              id="manual-link"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="https://relinkconnect.app/q/thomas"
              inputMode="url"
              autoCapitalize="none"
              className="min-h-11 border-white/25 bg-white/10 text-white placeholder:text-white/50"
            />
            <Button type="submit" className="min-h-11 shrink-0">
              <QrCode className="size-4" /> Ouvrir
            </Button>
          </div>
          <p className="text-xs text-white/60">
            Seuls les liens de vitrine ReLink sont acceptés.
          </p>
        </form>
      </div>
    </div>
  );
}
