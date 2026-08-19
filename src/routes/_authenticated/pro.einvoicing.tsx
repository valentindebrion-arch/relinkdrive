import { createFileRoute } from "@tanstack/react-router";
import { EinvoicingPage } from "@/components/pro/EinvoicingPage";

export const Route = createFileRoute("/_authenticated/pro/einvoicing")({
  head: () => ({
    meta: [
      { title: "Facturation électronique — Relink" },
      {
        name: "description",
        content:
          "Pilotez vos obligations de facturation électronique VTC : Factur-X, e-reporting, transmission via plateforme agréée et suivi des statuts.",
      },
      { property: "og:title", content: "Facturation électronique — Relink" },
      {
        property: "og:description",
        content: "Factur-X, e-reporting et suivi des factures pour les chauffeurs VTC indépendants.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EinvoicingPage,
});
