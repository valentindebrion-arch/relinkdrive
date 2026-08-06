import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pro/activite")({
  beforeLoad: () => {
    throw redirect({ to: "/pro/factures", replace: true });
  },
});
