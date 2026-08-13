import { createFileRoute } from "@tanstack/react-router";
import { DossierPage } from "@/components/pro/DossierPage";

export const Route = createFileRoute("/_authenticated/pro/dossier/")({
  head: () => ({
    meta: [
      { title: "Statut de mon compte — ReLink" },
      {
        name: "description",
        content:
          "Suivez l'avancement de votre dossier chauffeur ReLink et transmettez-le pour vérification.",
      },
      { property: "og:title", content: "Statut de mon compte — ReLink" },
      {
        property: "og:description",
        content: "Progression et envoi du dossier de vérification chauffeur ReLink.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { section?: string } =>
    typeof search["section"] === "string" ? { section: search["section"] } : {},
  component: DossierPage,
});
