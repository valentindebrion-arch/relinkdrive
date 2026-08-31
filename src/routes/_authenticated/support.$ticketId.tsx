/** Fil d'une demande SAV côté utilisateur. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getTicket, markUserRead } from "@/lib/support-queries";
import { SUPPORT_STATUS_LABELS } from "@/lib/support";
import { formatDateTime } from "@/lib/labels";
import { PageHeader, EmptyState } from "@/components/Ui";
import { TicketThread } from "@/components/support/TicketThread";

export const Route = createFileRoute("/_authenticated/support/$ticketId")({
  head: () => ({
    meta: [
      { title: "Ma demande — Support ReLink" },
      {
        name: "description",
        content: "Consultez les échanges avec l'équipe support ReLink sur votre demande.",
      },
      { property: "og:title", content: "Ma demande — Support ReLink" },
      { property: "og:description", content: "Suivi d'une demande support ReLink." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TicketPage,
});

function TicketPage() {
  const { ticketId } = Route.useParams();
  const { user } = useAuth();

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["support", "ticket", ticketId],
    queryFn: () => getTicket(ticketId),
  });

  useEffect(() => {
    if (ticket?.user_unread) void markUserRead(ticketId);
  }, [ticket?.user_unread, ticketId]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        to="/support"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Mes demandes
      </Link>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : !ticket ? (
        <EmptyState title="Demande introuvable" />
      ) : (
        <>
          <PageHeader
            title={`#${ticket.ticket_number} — ${ticket.subject}`}
            description={`${SUPPORT_STATUS_LABELS[ticket.status]} · créée le ${formatDateTime(ticket.created_at)}`}
          />
          <TicketThread
            ticketId={ticket.id}
            viewer="user"
            authorId={user?.id ?? ""}
            canReply={ticket.status !== "closed"}
          />
        </>
      )}
    </div>
  );
}
