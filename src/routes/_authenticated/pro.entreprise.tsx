import { createFileRoute } from "@tanstack/react-router";
import { CompanyPage } from "@/components/pro/CompanyPage";

export const Route = createFileRoute("/_authenticated/pro/entreprise")({
  component: CompanyPage,
});
