/** Mes demandes SAV (client ou chauffeur). */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LifeBuoy, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { listMyTickets } from "@/lib/support-queries";
import { SUPPORT_STATUS_LABELS, supportStatusTone } from "@/lib/support";
import { formatDateTime } from "@/lib/labels";
import { EmptyState, PageHeader } from "@/components/Ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/support/")({
  head: () => ({
    meta: [
      { title: "Mes demandes — Support ReLink" },
      {
        name: "description",
        content:
          "Suivez vos demandes envoyées à l'équipe support ReLink et consultez les réponses reçues.",
      },
      { property: "og:title", content: "Mes demandes — Support ReLink" },
      { property: "og:description", content: "Vos demandes au support ReLink." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyTickets,
});

const TONE_CLASS: Record<string, string> = {
  info: "bg-accent text-accent-foreground",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  neutral: "bg-muted text-muted-foreground",
  danger: "bg-destructive/15 text-destructive",
};

function MyTickets() {
  const { user } = useAuth();
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support", "mine", user?.id],
    enabled: !!user?.id,
    queryFn: () => listMyTickets(user!.id),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        to="/aide"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Centre d'aide
      </Link>

      <PageHeader
        title="Mes demandes"
        description="Vos échanges avec l'équipe support ReLink."
        action={
          <Button asChild size="sm" className="min-h-10">
            <Link to="/support/nouveau">
              <Plus className="size-4" /> Nouvelle
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (tickets ?? []).length === 0 ? (
        <EmptyState
          title="Aucune demande"
          description="Contactez le support ReLink si vous rencontrez un problème."
        />
      ) : (
        <div className="space-y-3">
          {(tickets ?? []).map((t) => (
            <Link
              key={t.id}
              to="/support/$ticketId"
              params={{ ticketId: t.id }}
              className="surface block p-4 transition hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    #{t.ticket_number} — {t.subject}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Dernier message : {formatDateTime(t.last_message_at)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[supportStatusTone(t.status)]}`}
                >
                  {SUPPORT_STATUS_LABELS[t.status]}
                </span>
              </div>
              {t.user_unread ? (
                <Badge className="mt-2" variant="secondary">
                  <LifeBuoy className="size-3.5" /> Réponse du support disponible
                </Badge>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
