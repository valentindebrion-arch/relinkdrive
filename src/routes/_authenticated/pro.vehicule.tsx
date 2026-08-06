import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pro/vehicule")({
  beforeLoad: () => {
    throw redirect({ to: "/pro/profil", replace: true });
  },
});
