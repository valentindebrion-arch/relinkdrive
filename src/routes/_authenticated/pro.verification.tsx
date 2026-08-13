import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pro/verification")({
  beforeLoad: () => {
    throw redirect({ to: "/pro/dossier/completer", replace: true });
  },
});
