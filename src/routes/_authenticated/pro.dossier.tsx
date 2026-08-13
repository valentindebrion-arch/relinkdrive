import { createFileRoute } from "@tanstack/react-router";
import { DossierPage } from "@/components/pro/DossierPage";

export const Route = createFileRoute("/_authenticated/pro/dossier")({
  validateSearch: (search: Record<string, unknown>): { section?: string } =>
    typeof search["section"] === "string" ? { section: search["section"] } : {},
  component: DossierPage,
});
