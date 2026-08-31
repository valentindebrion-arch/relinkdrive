import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pro/dossier")({
  beforeLoad: () => {
    throw redirect({ to: "/pro", replace: true });
  },
});
