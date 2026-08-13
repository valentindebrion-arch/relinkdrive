import { createFileRoute } from "@tanstack/react-router";
import { DossierWizard } from "@/components/pro/DossierWizard";

export const Route = createFileRoute("/_authenticated/pro/dossier/completer")({
  validateSearch: (search: Record<string, unknown>): { section?: string } =>
    typeof search["section"] === "string" ? { section: search["section"] } : {},
  component: DossierWizard,
});
