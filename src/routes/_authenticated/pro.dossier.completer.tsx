import { createFileRoute } from "@tanstack/react-router";
import { DossierWizard } from "@/components/pro/DossierWizard";

export const Route = createFileRoute("/_authenticated/pro/dossier/completer")({
  head: () => ({
    meta: [
      { title: "Compléter mon dossier — ReLink" },
      {
        name: "description",
        content:
          "Complétez les informations nécessaires à la vérification de votre compte chauffeur ReLink.",
      },
      { property: "og:title", content: "Compléter mon dossier — ReLink" },
      {
        property: "og:description",
        content: "Parcours sécurisé de vérification du compte chauffeur ReLink.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { section?: string } =>
    typeof search["section"] === "string" ? { section: search["section"] } : {},
  component: DossierWizard,
});
