import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useDriverProfile } from "@/lib/driver-queries";
import { isDriverActive } from "@/lib/driver-dossier";
import { PageHeader } from "@/components/Ui";
import { ShowcaseEditor } from "@/components/pro/ShowcaseEditor";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/pro/")({
  component: ProShowcase,
});

function ProShowcase() {
  const driver = useDriverProfile();
  const published = isDriverActive(driver.data?.verification_status);

  return (
    <>
      <PageHeader
        title="Ma vitrine"
        description={`Votre page publique ${BRAND.name} : cliquez sur une partie pour la modifier.`}
      />

      {!published ? (
        <div className="surface mb-4 flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="font-medium">Vitrine pas encore publiée</p>
            <p className="text-sm text-muted-foreground">
              Vous pouvez la construire dès maintenant : elle sera visible dans l'annuaire une fois
              votre dossier vérifié.
            </p>
          </div>
          <Link to="/pro/dossier" className="shrink-0 text-sm font-medium text-primary">
            Mon dossier <ArrowRight className="inline size-4" />
          </Link>
        </div>
      ) : null}

      <ShowcaseEditor />
    </>
  );
}
