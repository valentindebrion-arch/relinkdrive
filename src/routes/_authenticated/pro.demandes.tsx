import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pro/demandes")({
  validateSearch: (search: Record<string, unknown>) => ({
    demande: typeof search["demande"] === "string" ? (search["demande"] as string) : undefined,
  }),
  beforeLoad: ({ search }) => {
    // Le lien d'une notification push pointe sur la demande concernée.
    throw redirect({
      to: "/pro/courses",
      search: search.demande ? { demande: search.demande } : {},
      replace: true,
    });
  },
});
