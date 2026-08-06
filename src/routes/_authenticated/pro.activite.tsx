import { createFileRoute } from "@tanstack/react-router";
import { ActivityPage } from "@/components/pro/ActivityPage";

export const Route = createFileRoute("/_authenticated/pro/activite")({
  component: ActivityPage,
});
