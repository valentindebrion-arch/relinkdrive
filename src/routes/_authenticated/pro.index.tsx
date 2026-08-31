import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/Ui";
import { ShowcaseEditor } from "@/components/pro/ShowcaseEditor";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/pro/")({
  component: ProShowcase,
});

function ProShowcase() {
  return (
    <>
      <PageHeader
        title="Ma vitrine"
        description={`Votre page publique ${BRAND.name} : cliquez sur une partie pour la modifier.`}
      />
      <ShowcaseEditor />
    </>
  );
}
