/** Ticket SAV — vue administrateur : contexte, profil lié, réponse et statut. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { adminMarkRead, adminSetStatus, getTicket } from "@/lib/support-queries";
import { SUPPORT_STATUSES, SUPPORT_STATUS_LABELS, USER_KIND_LABELS } from "@/lib/support";
import { formatDateTime } from "@/lib/labels";
import { EmptyState, PageHeader } from "@/components/Ui";
import { Button } from "@/components/ui/button";
import { TicketThread } from "@/components/support/TicketThread";

export const Route = createFileRoute("/_authenticated/admin/support/$ticketId")({
  head: () => ({
    meta: [
      { title: "Ticket SAV — Administration ReLink" },
      {
        name: "description",
        content: "Traitement d'une demande SAV ReLink : contexte du compte, réponse et statut.",
      },
      { property: "og:title", content: "Ticket SAV — Administration ReLink" },
      { property: "og:description", content: "Détail d'un ticket support ReLink." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTicketPage,
});

function AdminTicketPage() {
  const { ticketId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["support", "ticket", ticketId],
    queryFn: () => getTicket(ticketId),
  });

  const { data: person } = useQuery({
    queryKey: ["support", "ticket-person", ticket?.user_id],
    enabled: !!ticket?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, created_at")
        .eq("id", ticket!.user_id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (ticket?.admin_unread) void adminMarkRead(ticketId);
  }, [ticket?.admin_unread, ticketId]);

  async function setStatus(status: (typeof SUPPORT_STATUSES)[number]) {
    if (!user?.id) return;
    try {
      await adminSetStatus(ticketId, status, user.id);
      await qc.invalidateQueries({ queryKey: ["support"] });
      await qc.invalidateQueries({ queryKey: ["admin", "support"] });
      toast.success(`Ticket marqué « ${SUPPORT_STATUS_LABELS[status]} »`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mise à jour impossible");
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!ticket) return <EmptyState title="Ticket introuvable" />;

  return (
    <div>
      <Link
        to="/admin/support"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Support
      </Link>

      <PageHeader
        title={`Ticket #${ticket.ticket_number} — ${ticket.subject}`}
        description={`${USER_KIND_LABELS[ticket.user_kind]} · créé le ${formatDateTime(ticket.created_at)}`}
        action={
          ticket.user_kind === "driver" ? (
            <Button asChild size="sm" className="min-h-10">
              <Link to="/admin/chauffeurs/$driverId" params={{ driverId: ticket.user_id }}>
                <UserCog className="size-4" /> Voir le profil
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" className="min-h-10">
              <Link to="/admin/utilisateurs/$clientId" params={{ clientId: ticket.user_id }}>
                <UserCog className="size-4" /> Voir le profil
              </Link>
            </Button>
          )
        }
      />

      <section className="surface mb-4 p-4 text-sm">
        <p className="font-medium">{person?.full_name ?? "Compte"}</p>
        <p className="text-muted-foreground">
          {person?.email ?? "—"} · {person?.phone ?? "—"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Motif : {ticket.category}</p>
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        {SUPPORT_STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={ticket.status === s ? "default" : "outline"}
            onClick={() => void setStatus(s)}
          >
            {SUPPORT_STATUS_LABELS[s]}
          </Button>
        ))}
      </div>

      <TicketThread
        ticketId={ticket.id}
        viewer="admin"
        authorId={user?.id ?? ""}
        canReply={ticket.status !== "closed"}
      />
    </div>
  );
}
