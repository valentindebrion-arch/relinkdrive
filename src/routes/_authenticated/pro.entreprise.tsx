import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pro/entreprise")({
  beforeLoad: () => {
    throw redirect({ to: "/pro/profil", replace: true });
  },
});
