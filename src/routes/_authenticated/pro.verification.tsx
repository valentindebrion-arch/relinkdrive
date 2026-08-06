import { createFileRoute } from "@tanstack/react-router";
import { VerificationPage } from "@/components/pro/VerificationPage";

export const Route = createFileRoute("/_authenticated/pro/verification")({
  component: VerificationPage,
});
