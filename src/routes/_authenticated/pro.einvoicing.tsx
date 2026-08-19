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
  // Limite d'erreur locale : une panne du module de facturation électronique
  // ne doit jamais rendre le reste de ReLink indisponible.
  errorComponent: ({ error }: { error: Error }) => {
    console.error(error);
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">
          Facturation électronique indisponible
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette fonctionnalité n'est pas encore configurée ou rencontre une erreur temporaire. Le
          reste de votre espace professionnel reste accessible.
        </p>
      </div>
    );
  },
});
