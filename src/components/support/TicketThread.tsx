/**
 * Fil d'un ticket SAV : utilisateur ↔ support ReLink uniquement.
 * Aucun échange direct entre utilisateurs n'est possible ici.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { attachmentUrl, listMessages, replyToTicket } from "@/lib/support-queries";
import { formatDateTime } from "@/lib/labels";
import type { SupportMessage } from "@/lib/support";

function Attachment({ path }: { path: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-2"
      onClick={async () => {
        setBusy(true);
        try {
          window.open(await attachmentUrl(path), "_blank", "noopener");
        } catch {
          toast.error("Pièce jointe indisponible");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Paperclip className="size-3.5" /> Voir la pièce jointe
    </button>
  );
}

function Bubble({ message, viewer }: { message: SupportMessage; viewer: "user" | "admin" }) {
  const mine = message.author_kind === viewer;
  const who = message.author_kind === "admin" ? "Support ReLink" : "Utilisateur";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl border p-3 text-sm ${
          message.author_kind === "admin"
            ? "border-primary/30 bg-accent/50"
            : "border-border bg-card"
        }`}
      >
        <p className="text-xs font-semibold text-muted-foreground">
          {mine ? "Vous" : who} · {formatDateTime(message.created_at)}
        </p>
        <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
        {message.attachment_path ? <Attachment path={message.attachment_path} /> : null}
      </div>
    </div>
  );
}

export function TicketThread({
  ticketId,
  viewer,
  authorId,
  canReply,
}: {
  ticketId: string;
  viewer: "user" | "admin";
  authorId: string;
  canReply: boolean;
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["support", "messages", ticketId],
    queryFn: () => listMessages(ticketId),
  });

  const send = useMutation({
    mutationFn: async () =>
      replyToTicket({ ticketId, authorId, authorKind: viewer, body: body.trim(), attachment: file }),
    onSuccess: async () => {
      setBody("");
      setFile(null);
      await qc.invalidateQueries({ queryKey: ["support"] });
      toast.success("Message envoyé");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Envoi impossible"),
  });

  return (
    <div>
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          (messages ?? []).map((m) => <Bubble key={m.id} message={m} viewer={viewer} />)
        )}
      </div>

      {canReply ? (
        <div className="surface mt-4 p-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            rows={4}
            placeholder={
              viewer === "admin" ? "Réponse du support ReLink…" : "Votre message au support…"
            }
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm">
              <Paperclip className="size-4" />
              {file ? file.name.slice(0, 24) : "Pièce jointe"}
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <Button
              className="min-h-10"
              disabled={!body.trim() || send.isPending}
              onClick={() => send.mutate()}
            >
              <Send className="size-4" /> {send.isPending ? "Envoi…" : "Envoyer"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Cette demande est fermée. Ouvrez une nouvelle demande si nécessaire.
        </p>
      )}
    </div>
  );
}
