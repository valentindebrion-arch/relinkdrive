/** Création d'un ticket SAV ReLink (utilisateur ↔ support uniquement). */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Paperclip } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { createTicket } from "@/lib/support-queries";
import { SUPPORT_CATEGORIES } from "@/lib/support";
import { PageHeader } from "@/components/Ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const searchSchema = z.object({
  motif: z.string().optional(),
  message: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/support/nouveau")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Contacter le support ReLink" },
      {
        name: "description",
        content:
          "Envoyez une demande à l'équipe support ReLink : compte, vitrine, véhicule, estimateur ou problème technique.",
      },
      { property: "og:title", content: "Contacter le support ReLink" },
      { property: "og:description", content: "Formulaire de demande au support ReLink." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewTicket,
});

function NewTicket() {
  const { user, profile, isDriver } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [category, setCategory] = useState<string>(
    search.motif && (SUPPORT_CATEGORIES as readonly string[]).includes(search.motif)
      ? search.motif
      : SUPPORT_CATEGORIES[0],
  );
  const [message, setMessage] = useState(search.message ?? "");
  const [file, setFile] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Session expirée");
      if (message.trim().length < 5) throw new Error("Merci de décrire votre demande.");
      return createTicket({
        userId: user.id,
        userKind: isDriver ? "driver" : "client",
        category,
        message: message.trim(),
        originPath: search.motif ? "Correction d'informations personnelles" : null,
        attachment: file,
      });
    },
    onSuccess: (ticket) => {
      toast.success(`Demande #${ticket.ticket_number} envoyée`);
      void navigate({ to: "/support/$ticketId", params: { ticketId: ticket.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Envoi impossible"),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        to="/support"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Mes demandes
      </Link>

      <PageHeader
        title="Contacter le support ReLink"
        description="Notre équipe vous répond directement dans ReLink."
      />

      <div className="surface p-5">
        <p className="text-xs text-muted-foreground">
          Vos informations de compte ({profile?.full_name || "—"} · {profile?.email || "—"} ·{" "}
          {isDriver ? "Chauffeur" : "Client"}) sont jointes automatiquement.
        </p>

        <label className="mt-4 block text-sm font-semibold" htmlFor="motif">
          Motif
        </label>
        <select
          id="motif"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
        >
          {SUPPORT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-semibold" htmlFor="message">
          Message
        </label>
        <Textarea
          id="message"
          rows={6}
          maxLength={4000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1"
          placeholder="Décrivez votre demande…"
        />

        <label className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm">
          <Paperclip className="size-4" />
          {file ? file.name.slice(0, 28) : "Pièce jointe (optionnelle)"}
          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP ou PDF — 8 Mo maximum.</p>

        <Button
          className="mt-5 min-h-11 w-full"
          disabled={submit.isPending}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? "Envoi…" : "Envoyer ma demande"}
        </Button>
      </div>
    </div>
  );
}
