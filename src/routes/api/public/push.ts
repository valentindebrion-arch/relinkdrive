import { createFileRoute } from "@tanstack/react-router";

/** Le système de notifications push a été retiré de ReLink : l'endpoint ne fait plus rien. */
export const Route = createFileRoute("/api/public/push")({
  server: {
    handlers: {
      POST: async () => Response.json({ disabled: true, sent: 0 }, { status: 410 }),
    },
  },
});
