import { createFileRoute } from "@tanstack/react-router";
import { DriverApplicationReview } from "@/components/admin/DriverApplicationReview";

export const Route = createFileRoute("/_authenticated/admin/inscriptions/$driverId")({
  head: () => ({
    meta: [
      { title: "Validation d'une demande chauffeur — ReLink" },
      {
        name: "description",
        content:
          "Contrôle des pièces obligatoires et autorisation d'un chauffeur professionnel sur ReLink.",
      },
      { property: "og:title", content: "Validation d'une demande chauffeur — ReLink" },
      {
        property: "og:description",
        content: "Validation document par document puis autorisation finale du chauffeur.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <DriverApplicationReview driverId={Route.useParams().driverId} />,
});
