import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/Ui";
import { TariffSection } from "@/components/pro/TariffSection";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/pro/tarification")({
  head: () => ({
    meta: [
      { title: "Mes tarifs — ReLink" },
      {
        name: "description",
        content:
          "Renseignez vos informations tarifaires ReLink : prix au kilomètre, course minimum et prise en charge. Elles alimentent l'estimation indicative de votre vitrine.",
      },
      { property: "og:title", content: "Mes tarifs — ReLink" },
      {
        property: "og:description",
        content: "Prix au kilomètre, course minimum et prise en charge affichés sur votre vitrine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <>
      <PageHeader
        title="Mes tarifs"
        description="Ces informations permettent à vos visiteurs de situer votre positionnement tarifaire."
      />
      <TariffSection />
      <p className="mt-4 text-xs text-muted-foreground">
        {BRAND.name} n'encaisse rien et n'émet aucune facture. Le tarif définitif est convenu
        directement entre vous et votre client.
      </p>
    </>
  );
}
