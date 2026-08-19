import { createFileRoute } from "@tanstack/react-router";
import { BillingCustomersPage } from "@/components/pro/BillingCustomersPage";

export const Route = createFileRoute("/_authenticated/pro/clients-factures")({
  head: () => ({
    meta: [
      { title: "Clients facturés — Relink" },
      {
        name: "description",
        content:
          "Gérez les clients facturés de votre activité VTC : particuliers, sociétés françaises et étrangères, conditions de règlement.",
      },
      { property: "og:title", content: "Clients facturés — Relink" },
      { property: "og:description", content: "Fiches clients facturés conformes à la facturation électronique." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillingCustomersPage,
});
