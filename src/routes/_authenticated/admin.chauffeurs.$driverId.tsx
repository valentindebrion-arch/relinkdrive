import { createFileRoute } from "@tanstack/react-router";
import { DossierReview } from "@/components/admin/DossierReview";

export const Route = createFileRoute("/_authenticated/admin/chauffeurs/$driverId")({
  head: () => ({
    meta: [
      { title: "Examen du dossier chauffeur — ReLink" },
      {
        name: "description",
        content:
          "Contrôle administratif détaillé d'un dossier chauffeur ReLink : pièces, informations déclarées et décisions.",
      },
      { property: "og:title", content: "Examen du dossier chauffeur — ReLink" },
      {
        property: "og:description",
        content: "Interface de modération des dossiers chauffeurs ReLink.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DossierDetailPage,
});

function DossierDetailPage() {
  const { driverId } = Route.useParams();
  return <DossierReview driverId={driverId} />;
}
