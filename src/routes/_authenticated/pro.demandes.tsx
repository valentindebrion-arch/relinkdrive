import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pro/demandes")({
  beforeLoad: () => {
    throw redirect({ to: "/pro/courses", replace: true });
  },
});
