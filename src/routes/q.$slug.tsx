/**
 * Lien traçable du QR code chauffeur : enregistre le scan puis redirige
 * immédiatement vers la vitrine publique. Le traçage ne contourne aucune
 * restriction d'accès (Woman for Woman reste contrôlé par la vitrine).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { trackDriverVisit } from "@/lib/visit-tracking";

export const Route = createFileRoute("/q/$slug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redirection vers la vitrine ReLink" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Ouverture de la vitrine ReLink du chauffeur." },
      { property: "og:title", content: "Vitrine ReLink" },
      { property: "og:description", content: "Ouverture de la vitrine ReLink du chauffeur." },
    ],
  }),
  component: QrRedirect,
});

function QrRedirect() {
  const { slug } = Route.useParams();

  useEffect(() => {
    const target = `/chauffeur/${slug}?src=qr`;
    void trackDriverVisit(slug, "qr_scan", "qr").finally(() => {
      window.location.replace(target);
    });
    // Filet de sécurité : redirection même si le réseau traîne.
    const timer = window.setTimeout(() => window.location.replace(target), 1200);
    return () => window.clearTimeout(timer);
  }, [slug]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">Ouverture de la vitrine…</p>
    </div>
  );
}
