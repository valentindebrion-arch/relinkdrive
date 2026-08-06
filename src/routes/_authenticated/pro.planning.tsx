import { createFileRoute } from "@tanstack/react-router";
import { Planning } from "@/components/pro/Planning";

export const Route = createFileRoute("/_authenticated/pro/planning")({
  component: Planning,
});
