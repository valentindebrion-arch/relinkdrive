import { createFileRoute } from "@tanstack/react-router";
import { DossierPage } from "@/components/pro/DossierPage";

export const Route = createFileRoute("/_authenticated/pro/dossier")({
  component: DossierPage,
});
